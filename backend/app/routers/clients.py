from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import secrets
from ..database import get_db
from ..schemas import ClientRegister, ClientCreatedResponse, ClientResponse
from ..models import ClientRegistry, Role, User
from ..core.auth_utils import get_current_user, hash_token

router = APIRouter(prefix="/clients", tags=["Clients Registry"])

@router.post("/", response_model=ClientCreatedResponse)
def register_client(
    payload: ClientRegister, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify role exists
    role = db.query(Role).filter(Role.id == payload.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    # Generate high-entropy API token
    api_token = f"so_tok_{secrets.token_hex(24)}"
    token_hash = hash_token(api_token)
    
    client = ClientRegistry(
        name=payload.name,
        api_token_hash=token_hash,
        role_id=payload.role_id,
        ip_whitelist=payload.ip_whitelist
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    
    # Map to schema containing plaintext token to show only once
    response = ClientCreatedResponse(
        id=client.id,
        name=client.name,
        role_id=client.role_id,
        ip_whitelist=client.ip_whitelist,
        created_at=client.created_at,
        last_active=client.last_active,
        is_active=client.is_active,
        api_token=api_token
    )
    return response

@router.get("/", response_model=List[ClientResponse])
def list_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(ClientRegistry).all()

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = db.query(ClientRegistry).filter(ClientRegistry.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(client)
    db.commit()
    return
