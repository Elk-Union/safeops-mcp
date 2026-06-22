from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import datetime
from ..database import get_db
from ..schemas import RollbackResponse
from ..models import RollbackSnapshot, User
from ..core.auth_utils import get_current_user
from ..core.rollback import RollbackEngine

router = APIRouter(prefix="/rollbacks", tags=["State Rollbacks"])

@router.get("/", response_model=List[RollbackResponse])
def list_rollback_snapshots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    snapshots = db.query(RollbackSnapshot).order_by(RollbackSnapshot.created_at.desc()).all()
    # Format target strings for response privacy if needed, but since it's admin, raw is fine
    return snapshots

@router.post("/{snapshot_id}/restore", response_model=RollbackResponse)
def restore_snapshot(
    snapshot_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    snapshot = db.query(RollbackSnapshot).filter(RollbackSnapshot.id == snapshot_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
        
    if snapshot.is_rolled_back:
        raise HTTPException(status_code=400, detail="Snapshot has already been restored")
        
    success = RollbackEngine.trigger_rollback(db, snapshot)
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to restore system checkpoint. Check backup archive status."
        )
        
    return snapshot
