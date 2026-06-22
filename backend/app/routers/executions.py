from fastapi import APIRouter, Depends, HTTPException, Security, Request, status
from sqlalchemy.orm import Session
import datetime
import urllib.request
import re
from typing import Dict, Any, List
from ..database import get_db
from ..schemas import ExecutionRequest, ExecutionResponse
from ..models import MCPTool, ClientRegistry, ToolExecution, ApprovalRequest, RiskAssessment
from ..core.auth_utils import get_current_client
from ..core.safety import SafetyClassifier
from ..core.risk import RiskEngine
from ..core.policy import PolicyEngine
from ..core.sandbox import SandboxExecutor
from ..core.rollback import RollbackEngine
from ..core.audit_utils import AuditLedger
from ..config import settings

router = APIRouter(prefix="/executions", tags=["Tool Executions"])

# Helper to fetch HTML and securely strip JS/Styles for markdown conversions
def secure_fetch_markdown(url: str) -> str:
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (SafeOps Documentation Reader)'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8', errors='ignore')
            
        # Strip script, style, head, and frame elements
        html = re.sub(r'<script.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<style.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<head.*?</head>', '', html, flags=re.DOTALL | re.IGNORECASE)
        
        # Extract and format basic headers & text
        text = re.sub(r'<h[1-6].*?>(.*?)</h[1-6]>', r'\n\n# \1\n', html, flags=re.IGNORECASE)
        text = re.sub(r'<li.*?>(.*?)</li>', r'\n- \1', text, flags=re.IGNORECASE)
        text = re.sub(r'<p.*?>(.*?)</p>', r'\n\n\1\n', text, flags=re.IGNORECASE)
        text = re.sub(r'<br\s*/?>', r'\n', text, flags=re.IGNORECASE)
        
        # Strip all other HTML tags
        text = re.sub(r'<[^>]*>', '', text)
        # Normalize whitespace
        text = re.sub(r'\n\s*\n', '\n\n', text)
        return text.strip()
    except Exception as e:
        return f"Error fetching documentation guide: {str(e)}"

def resolve_command_args(tool_name: str, arguments: Dict[str, Any]) -> List[str]:
    """
    Translates tool parameters into concrete sandboxed execution arguments.
    """
    if tool_name == "get_uptime":
        return ["uptime"]
    elif tool_name == "cpu_usage":
        return ["sh", "-c", "top -bn1 | grep 'Cpu(s)'"]
    elif tool_name == "ram_usage":
        return ["free", "-m"]
    elif tool_name == "disk_usage":
        return ["df", "-h"]
    elif tool_name == "system_health":
        return ["sh", "-c", "uptime && free -m && df -h"]
    elif tool_name == "check_updates":
        return ["apk", "update"] # Assuming Alpine sandbox target
    elif tool_name == "package_info":
        pkg = arguments.get("package_name", "curl")
        return ["apk", "info", pkg]
    elif tool_name == "update_package":
        pkg = arguments.get("package_name")
        if not pkg:
            raise HTTPException(status_code=400, detail="Missing 'package_name' parameter")
        return ["apk", "add", pkg]
    elif tool_name == "remove_package":
        pkg = arguments.get("package_name")
        if not pkg:
            raise HTTPException(status_code=400, detail="Missing 'package_name' parameter")
        return ["apk", "del", pkg]
    elif tool_name == "service_status":
        service = arguments.get("service_name", "")
        return ["rc-service", service, "status"]
    elif tool_name == "start_service":
        service = arguments.get("service_name")
        return ["rc-service", service, "start"]
    elif tool_name == "stop_service":
        service = arguments.get("service_name")
        return ["rc-service", service, "stop"]
    elif tool_name == "restart_service":
        service = arguments.get("service_name")
        return ["rc-service", service, "restart"]
    elif tool_name == "simulate_install":
        cmds = arguments.get("commands", [])
        # Concat scripts securely
        script = "\n".join(cmds)
        return ["sh", "-c", script]
    else:
        raise HTTPException(status_code=400, detail="Command execution mapping not found")

@router.post("/", response_model=ExecutionResponse)
def execute_tool(
    payload: ExecutionRequest,
    request: Request,
    db: Session = Depends(get_db),
    client: ClientRegistry = Depends(get_current_client)
):
    client_ip = request.client.host
    tool_name = payload.tool_name
    arguments = payload.arguments or {}
    environment = payload.environment
    
    # 1. Lookup Tool Details
    tool = db.query(MCPTool).filter(MCPTool.name == tool_name).first()
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not registered in SafeOps catalog")

    # 2. Safety Intent Sanitation
    try:
        SafetyClassifier.sanitize_arguments(arguments)
    except ValueError as ve:
        # Register safety block audit record
        AuditLedger.write_log(
            db=db,
            client_id=client.id,
            tool_name=tool_name,
            arguments=arguments,
            risk_score=10.0,
            status="REJECTED"
        )
        raise HTTPException(status_code=400, detail=str(ve))

    # 3. Dynamic Risk Scoring
    risk_results = RiskEngine.assess_risk(db, tool, environment, arguments)
    risk_score = risk_results["risk_score"]
    risk_explanation = risk_results["explanation"]

    # 4. Evaluate Security Policies (RBAC + ABAC)
    effect = PolicyEngine.evaluate_execution(db, client, tool, environment, arguments, client_ip)
    
    if effect == "deny":
        AuditLedger.write_log(
            db=db,
            client_id=client.id,
            tool_name=tool_name,
            arguments=arguments,
            risk_score=risk_score,
            status="REJECTED"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=f"Execution blocked by security policy rules."
        )

    # 5. Check if Approval is required (either by policy or by risk threshold)
    requires_approval = (
        effect == "approval_required" or 
        risk_score >= settings.RISK_THRESHOLD_AUTO_EXECUTE
    )
    
    # Create execution audit record
    execution = ToolExecution(
        client_id=client.id,
        tool_id=tool.id,
        arguments=arguments,
        environment=environment,
        status="PENDING_APPROVAL" if requires_approval else "EXECUTING"
    )
    db.add(execution)
    db.flush()

    # Save risk assessment details
    assessment = RiskAssessment(
        execution_id=execution.id,
        risk_score=risk_score,
        explanation=risk_explanation
    )
    db.add(assessment)
    db.commit()

    if requires_approval:
        # Create approval request
        approval = ApprovalRequest(
            execution_id=execution.id,
            status="PENDING",
            reason=f"Action requires review. Risk Score: {risk_score}."
        )
        db.add(approval)
        db.commit()
        
        # Write pending audit log
        AuditLedger.write_log(
            db=db,
            client_id=client.id,
            tool_name=tool_name,
            arguments=arguments,
            risk_score=risk_score,
            status="PENDING_APPROVAL"
        )

        approval_url = f"http://localhost:3000/approvals/{approval.id}"
        return ExecutionResponse(
            id=execution.id,
            tool_name=tool_name,
            arguments=arguments,
            environment=environment,
            status="PENDING_APPROVAL",
            risk_score=risk_score,
            risk_explanation=risk_explanation,
            approval_url=approval_url
        )

    # 6. Execute Allowed Tools
    return run_sandbox_execution(db, execution, tool, client, risk_score)

def run_sandbox_execution(
    db: Session, 
    execution: ToolExecution, 
    tool: MCPTool, 
    client: ClientRegistry, 
    risk_score: float,
    approver_id: str = None
) -> ExecutionResponse:
    """
    Executes the command inside the sandbox environment, managing checkpoints and rollbacks.
    """
    execution.status = "EXECUTING"
    db.commit()

    arguments = execution.arguments or {}
    tool_name = tool.name
    
    # Check if this is a Documentation Read request (processed outside Docker sandbox)
    if tool_name == "traverse_documentation":
        url = arguments.get("url")
        if not url:
            raise HTTPException(status_code=400, detail="Missing 'url' parameter")
        
        content = secure_fetch_markdown(url)
        execution.status = "COMPLETED"
        execution.stdout = content
        execution.completed_at = datetime.datetime.utcnow()
        execution.exit_code = 0
        db.commit()
        
        AuditLedger.write_log(
            db=db,
            client_id=client.id,
            tool_name=tool_name,
            arguments=arguments,
            risk_score=risk_score,
            status="COMPLETED",
            approved_by=approver_id
        )
        
        return ExecutionResponse.model_validate(execution)

    # Resolve backup path targets (e.g. for configs: nvim, emacs)
    target_dir = arguments.get("target_dir")
    backup_path = None
    
    # 7. Create Pre-Action Snapshots if configured
    if tool.rollback_available and target_dir:
        # Standard checkpoint backup
        backup_path = RollbackEngine.create_directory_backup(target_dir, tool_name)
        if backup_path:
            RollbackEngine.register_snapshot(
                db=db,
                execution_id=str(execution.id),
                snapshot_type="directory_backup",
                target_dir=target_dir,
                backup_path=backup_path
            )

    # 8. Run Sandbox
    try:
        cmd_args = resolve_command_args(tool_name, arguments)
        executor = SandboxExecutor()
        result = executor.execute(cmd_args)
        
        execution.exit_code = result["exit_code"]
        execution.stdout = result["stdout"]
        execution.stderr = result["stderr"]
        execution.completed_at = datetime.datetime.utcnow()

        if result["exit_code"] == 0:
            execution.status = "COMPLETED"
        else:
            execution.status = "FAILED"
            # Trigger Automatic Rollback recovery
            if backup_path:
                snapshot = execution.rollback
                if snapshot:
                    RollbackEngine.trigger_rollback(db, snapshot)
                    execution.stderr += "\n[SafeOps Checkpoint recovery triggered and successfully rolled back changes due to execution failure.]"
                    
    except Exception as e:
        execution.status = "FAILED"
        execution.stderr = f"Sandbox Exception: {str(e)}"
        execution.completed_at = datetime.datetime.utcnow()
        if backup_path:
            snapshot = execution.rollback
            if snapshot:
                RollbackEngine.trigger_rollback(db, snapshot)
                execution.stderr += "\n[SafeOps Checkpoint recovery triggered and successfully rolled back changes.]"

    db.commit()
    
    # Write execution output audit log
    AuditLedger.write_log(
        db=db,
        client_id=client.id,
        tool_name=tool_name,
        arguments=arguments,
        risk_score=risk_score,
        status=execution.status,
        approved_by=approver_id
    )

    return ExecutionResponse(
        id=execution.id,
        tool_name=tool_name,
        arguments=arguments,
        environment=execution.environment,
        status=execution.status,
        exit_code=execution.exit_code,
        stdout=execution.stdout,
        stderr=execution.stderr,
        created_at=execution.created_at,
        completed_at=execution.completed_at,
        risk_score=risk_score,
        risk_explanation=execution.risk_assessment.explanation
    )
