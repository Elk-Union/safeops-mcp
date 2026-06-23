from fastapi import APIRouter, Depends, HTTPException, Security, Request, Response, status
from sqlalchemy.orm import Session
import datetime
import urllib.request
import re
import os
import shutil
try:
    import docker
except ImportError:
    docker = None
from typing import Dict, Any, List
from ..database import get_db
from ..schemas import ExecutionRequest, ExecutionResponse
from ..models import MCPTool, ClientRegistry, ToolExecution, ApprovalRequest, RiskAssessment, User
from ..core.auth_utils import get_current_client, get_current_user, get_current_user_or_client
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

def is_docker_active() -> bool:
    if not docker:
        return False
    try:
        client = docker.from_env()
        client.ping()
        return True
    except Exception:
        return False

def get_target_package_manager() -> str:
    """
    Returns 'apk' if Docker sandbox is active, otherwise detects host package manager.
    """
    if is_docker_active():
        return "apk"
        
    if shutil.which("pacman"):
        return "pacman"
    elif shutil.which("apt-get"):
        return "apt"
    elif shutil.which("dnf"):
        return "dnf"
    elif shutil.which("yum"):
        return "yum"
    elif shutil.which("brew"):
        return "brew"
    elif shutil.which("apk"):
        return "apk"
    return "apk" # Default fallback

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
        pm = get_target_package_manager()
        if pm == "pacman":
            return ["pacman", "-Sy"]
        elif pm == "apt":
            return ["sudo", "-n", "apt-get", "update"]
        elif pm == "dnf":
            return ["dnf", "check-update"]
        elif pm == "brew":
            return ["brew", "update"]
        else:
            return ["apk", "update"]
    elif tool_name == "package_info":
        pkg = arguments.get("package_name", "curl")
        pm = get_target_package_manager()
        if pm == "pacman":
            return ["pacman", "-Si", pkg]
        elif pm == "apt":
            return ["apt-cache", "show", pkg]
        elif pm == "dnf":
            return ["dnf", "info", pkg]
        elif pm == "brew":
            return ["brew", "info", pkg]
        else:
            return ["apk", "info", pkg]
    elif tool_name == "update_package":
        pkg = arguments.get("package_name")
        if not pkg:
            raise HTTPException(status_code=400, detail="Missing 'package_name' parameter")
        pm = get_target_package_manager()
        if pm == "pacman":
            return ["sudo", "-n", "pacman", "-S", "--noconfirm", pkg]
        elif pm == "apt":
            return ["sudo", "-n", "apt-get", "install", "-y", pkg]
        elif pm == "dnf":
            return ["sudo", "-n", "dnf", "install", "-y", pkg]
        elif pm == "brew":
            return ["brew", "install", pkg]
        else:
            return ["apk", "add", pkg]
    elif tool_name == "remove_package":
        pkg = arguments.get("package_name")
        if not pkg:
            raise HTTPException(status_code=400, detail="Missing 'package_name' parameter")
        pm = get_target_package_manager()
        if pm == "pacman":
            return ["sudo", "-n", "pacman", "-R", "--noconfirm", pkg]
        elif pm == "apt":
            return ["sudo", "-n", "apt-get", "remove", "-y", pkg]
        elif pm == "dnf":
            return ["sudo", "-n", "dnf", "remove", "-y", pkg]
        elif pm == "brew":
            return ["brew", "uninstall", pkg]
        else:
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
    elif tool_name == "pacman_package":
        op = arguments.get("operation", "install").lower()
        pkg = arguments.get("package_name")
        if not pkg and op in ["install", "remove", "query"]:
            raise HTTPException(status_code=400, detail="Missing 'package_name' parameter for this operation")
        
        if op == "install":
            return ["sudo", "-n", "pacman", "-S", "--noconfirm", pkg]
        elif op == "remove":
            return ["sudo", "-n", "pacman", "-R", "--noconfirm", pkg]
        elif op == "upgrade":
            return ["sudo", "-n", "pacman", "-Syu", "--noconfirm"]
        elif op == "query":
            return ["pacman", "-Qi", pkg]
        else:
            raise HTTPException(status_code=400, detail=f"Invalid pacman operation: {op}")
    else:
        raise HTTPException(status_code=400, detail="Command execution mapping not found")

@router.post("/", response_model=ExecutionResponse)
def execute_tool(
    payload: ExecutionRequest,
    request: Request,
    response: Response,
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
        response.status_code = status.HTTP_202_ACCEPTED
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
            created_at=execution.created_at,
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
    if tool_name in ["traverse_documentation", "lookup_package_doc"]:
        if tool_name == "traverse_documentation":
            url = arguments.get("url")
            if not url:
                raise HTTPException(status_code=400, detail="Missing 'url' parameter")
        else:
            package_name = arguments.get("package_name")
            if not package_name:
                raise HTTPException(status_code=400, detail="Missing 'package_name' parameter")
            platform = arguments.get("platform", "generic").lower()
            
            # Resolve url based on platform
            if platform == "pypi":
                import json
                try:
                    req = urllib.request.Request(
                        f"https://pypi.org/pypi/{package_name}/json",
                        headers={'User-Agent': 'Mozilla/5.0 (SafeOps Documentation Reader)'}
                    )
                    with urllib.request.urlopen(req, timeout=10) as response:
                        data = json.loads(response.read().decode('utf-8', errors='ignore'))
                        content = data.get("info", {}).get("description", "No description found.")
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
                        risk_explanation=execution.risk_assessment.explanation if execution.risk_assessment else None
                    )
                except Exception:
                    url = f"https://pypi.org/project/{package_name}/"
            elif platform == "npm":
                url = f"https://www.npmjs.com/package/{package_name}"
            elif platform == "github":
                if "/" in package_name:
                    url = f"https://github.com/{package_name}"
                else:
                    url = f"https://github.com/search?q={package_name}"
            else:
                if "/" in package_name:
                    url = f"https://github.com/{package_name}"
                else:
                    url = f"https://pypi.org/project/{package_name}/"
        
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
            risk_explanation=execution.risk_assessment.explanation if execution.risk_assessment else None
        )

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
        log_filepath = f"/tmp/safeops_sandbox_{execution.id}.log"
        result = executor.execute(cmd_args, log_filepath=log_filepath)
        
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

@router.get("/{execution_id}/live-logs")
def get_live_logs(
    execution_id: str,
    db: Session = Depends(get_db),
    current_user_or_client = Depends(get_current_user_or_client)
):
    execution = db.query(ToolExecution).filter(ToolExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution record not found")
        
    log_filepath = f"/tmp/safeops_sandbox_{execution_id}.log"
    logs = ""
    
    if os.path.exists(log_filepath):
        try:
            with open(log_filepath, "r", encoding="utf-8") as f:
                logs = f.read()
        except Exception as e:
            logs = f"Error reading logs: {str(e)}"
    else:
        # Fallback to database values
        stdout = execution.stdout or ""
        stderr = execution.stderr or ""
        logs = stdout
        if stderr:
            logs += f"\n--- STDERR ---\n{stderr}"
            
    return {
        "id": execution.id,
        "status": execution.status,
        "logs": logs
    }

@router.get("/")
def list_executions(
    limit: int = 15,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    executions = db.query(ToolExecution).order_by(ToolExecution.created_at.desc()).limit(limit).all()
    res = []
    for e in executions:
        res.append({
            "id": e.id,
            "tool_name": e.tool.name,
            "arguments": e.arguments,
            "environment": e.environment,
            "status": e.status,
            "exit_code": e.exit_code,
            "created_at": e.created_at,
            "completed_at": e.completed_at,
            "risk_score": e.risk_assessment.risk_score if e.risk_assessment else 0.0
        })
    return res
