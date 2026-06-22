from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import Token, UserLogin, UserCreate, UserResponse
from ..models import User, Role
from ..core.auth_utils import verify_password, get_password_hash, create_access_token, get_current_user
import uuid

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login_for_access_token(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Sign JWT, include user role name
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.name})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=UserResponse)
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    # Verify email uniqueness
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    role = db.query(Role).filter(Role.id == payload.role_id).first()
    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found"
        )

    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role_id=payload.role_id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
