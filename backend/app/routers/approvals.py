from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import datetime
from ..database import get_db
from ..schemas import ApprovalDecision, ApprovalResponse, ExecutionResponse
from ..models import ApprovalRequest, User
from ..core.auth_utils import get_current_user
from .executions import run_sandbox_execution

router = APIRouter(prefix="/approvals", tags=["Approvals Workflow"])

@router.get("/", response_model=List[ApprovalResponse])
def list_approvals(
    status_filter: str = "PENDING",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ApprovalRequest)
    if status_filter:
        query = query.filter(ApprovalRequest.status == status_filter.upper())
    
    requests = query.all()
    response_list = []
    
    for req in requests:
        exec_record = req.execution
        risk_record = exec_record.risk_assessment
        
        response_list.append(
            ApprovalResponse(
                id=req.id,
                execution_id=req.execution_id,
                status=req.status,
                reason=req.reason,
                approver_id=req.approver_id,
                decided_at=req.decided_at,
                created_at=req.created_at,
                tool_name=exec_record.tool.name,
                arguments=exec_record.arguments,
                environment=exec_record.environment,
                risk_score=risk_record.risk_score if risk_record else 1.0,
                risk_explanation=risk_record.explanation if risk_record else ""
            )
        )
        
    return response_list

@router.post("/{approval_id}/decide", response_model=ExecutionResponse)
def decide_approval_request(
    approval_id: str,
    payload: ApprovalDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
        
    if approval.status != "PENDING":
        raise HTTPException(status_code=400, detail="This approval request has already been resolved")

    decision = payload.decision.upper()
    if decision not in ["APPROVED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Decision must be APPROVED or REJECTED")

    approval.status = decision
    approval.reason = payload.reason
    approval.approver_id = current_user.id
    approval.decided_at = datetime.datetime.utcnow()
    
    execution = approval.execution
    
    if decision == "REJECTED":
        execution.status = "REJECTED"
        db.commit()
        
        # Write rejected audit log
        from ..core.audit_utils import AuditLedger
        AuditLedger.write_log(
            db=db,
            client_id=execution.client_id,
            tool_name=execution.tool.name,
            arguments=execution.arguments,
            risk_score=execution.risk_assessment.risk_score,
            status="REJECTED",
            user_id=current_user.id,
            approved_by=current_user.id
        )
        
        return ExecutionResponse(
            id=execution.id,
            tool_name=execution.tool.name,
            arguments=execution.arguments,
            environment=execution.environment,
            status="REJECTED",
            risk_score=execution.risk_assessment.risk_score,
            risk_explanation=execution.risk_assessment.explanation
        )

    # If APPROVED: Fire execution pipeline
    db.commit()
    
    return run_sandbox_execution(
        db=db,
        execution=execution,
        tool=execution.tool,
        client=execution.client,
        risk_score=execution.risk_assessment.risk_score,
        approver_id=current_user.id
    )
