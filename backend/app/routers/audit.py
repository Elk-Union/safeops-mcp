from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas import AuditLogResponse
from ..models import AuditLog, User
from ..core.auth_utils import get_current_user
from ..core.policy import PolicyResolver # Used if we want to check network context or verify hashes

router = APIRouter(prefix="/audit", tags=["Audit Log"])

@router.get("/", response_model=List[AuditLogResponse])
def get_audit_ledger(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).all()
    response_list = []
    
    for log in logs:
        # Resolve names for display
        client_name = log.client_id
        try:
            from ..models import ClientRegistry
            client = db.query(ClientRegistry).filter(ClientRegistry.id == log.client_id).first()
            if client:
                client_name = client.name
        except Exception:
            pass
            
        approver_email = None
        if log.approved_by:
            try:
                approver = db.query(User).filter(User.id == log.approved_by).first()
                if approver:
                    approver_email = approver.email
            except Exception:
                pass
                
        response_list.append(
            AuditLogResponse(
                id=log.id,
                timestamp=log.timestamp,
                client_name=client_name,
                tool_name=log.tool_name,
                arguments_hash=log.arguments_hash,
                risk_score=log.risk_score,
                status=log.status,
                approved_by_email=approver_email,
                row_hash=log.row_hash
            )
        )
        
    return response_list

@router.post("/verify")
def trigger_ledger_verification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Validates if the historical SHA256 chain has been broken or tampered with.
    """
    from docs.architecture_kb import verify_audit_ledger
    # Wait, we wrote the verification function inside app.core.audit_utils. Let's load that!
    from ..core.audit_utils import AuditLedger
    
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.asc()).all()
    if not logs:
        return {"status": "verified", "message": "Audit ledger is empty."}
        
    expected_previous = "0" * 64
    for idx, log in enumerate(logs):
        if log.previous_hash != expected_previous:
            raise HTTPException(
                status_code=500,
                detail=f"Ledger verification failed: Previous hash mismatch at record index {idx} (ID: {log.id})."
            )
            
        payload = f"{log.previous_hash}|{log.timestamp.isoformat()}|{log.user_id if log.user_id else ''}|{log.client_id}|{log.tool_name}|{log.arguments_hash}|{log.risk_score if log.risk_score else 0.0}|{log.status}"
        import hashlib
        calculated_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        
        if log.row_hash != calculated_hash:
            raise HTTPException(
                status_code=500,
                detail=f"Ledger verification failed: Data tampering detected at record ID {log.id}."
            )
            
        expected_previous = calculated_hash
        
    return {"status": "verified", "message": f"Verified {len(logs)} ledger records. Hash chain integrity is intact."}
