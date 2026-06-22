from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas import PolicyCreate, PolicyResponse
from ..models import PolicyRule, User
from ..core.auth_utils import get_current_user

router = APIRouter(prefix="/policies", tags=["Policies Rules"])

@router.post("/", response_model=PolicyResponse)
def create_policy_rule(
    payload: PolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify policy uniqueness per role, tool, environment
    existing = db.query(PolicyRule).filter(
        PolicyRule.role_id == payload.role_id,
        PolicyRule.tool_id == payload.tool_id,
        PolicyRule.environment == payload.environment
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Policy already exists for this role, tool, and environment combination."
        )

    policy = PolicyRule(
        role_id=payload.role_id,
        tool_id=payload.tool_id,
        environment=payload.environment,
        effect=payload.effect,
        rules_json=payload.rules_json
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy

@router.get("/", response_model=List[PolicyResponse])
def list_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(PolicyRule).all()

@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_policy_rule(
    policy_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    policy = db.query(PolicyRule).filter(PolicyRule.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    db.delete(policy)
    db.commit()
    return
