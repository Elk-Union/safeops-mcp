from pydantic import BaseModel, EmailStr, Field
from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role_id: UUID

class UserResponse(BaseModel):
    id: UUID
    email: str
    role_id: UUID
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Client Schemas
class ClientRegister(BaseModel):
    name: str
    role_id: UUID
    ip_whitelist: Optional[str] = None

class ClientResponse(BaseModel):
    id: UUID
    name: str
    role_id: UUID
    ip_whitelist: Optional[str]
    created_at: datetime
    last_active: Optional[datetime]
    is_active: bool

    class Config:
        from_attributes = True

class ClientCreatedResponse(ClientResponse):
    api_token: str # plaintext token, only shown once upon creation

# Tool Schemas
class ToolResponse(BaseModel):
    id: UUID
    name: str
    category: str
    description: Optional[str]
    base_risk: float
    requires_approval_above: float
    rollback_available: bool

    class Config:
        from_attributes = True

# Policy Schemas
class PolicyCreate(BaseModel):
    role_id: UUID
    tool_id: UUID
    environment: str = "*"
    effect: str # allow, deny, approval_required
    rules_json: Optional[Dict[str, Any]] = None

class PolicyResponse(BaseModel):
    id: UUID
    role_id: UUID
    tool_id: UUID
    environment: str
    effect: str
    rules_json: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True

# Execution Schemas
class ExecutionRequest(BaseModel):
    tool_name: str
    arguments: Optional[Dict[str, Any]] = None
    environment: str = "development"

class RiskAssessmentResponse(BaseModel):
    risk_score: float
    explanation: str

class ExecutionResponse(BaseModel):
    id: UUID
    tool_name: str
    arguments: Optional[Dict[str, Any]]
    environment: str
    status: str
    exit_code: Optional[int] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    risk_score: Optional[float] = None
    risk_explanation: Optional[str] = None
    approval_url: Optional[str] = None

    class Config:
        from_attributes = True

# Approval Schemas
class ApprovalDecision(BaseModel):
    decision: str # APPROVED, REJECTED
    reason: Optional[str] = None

class ApprovalResponse(BaseModel):
    id: UUID
    execution_id: UUID
    status: str
    reason: Optional[str]
    approver_id: Optional[UUID]
    decided_at: Optional[datetime]
    created_at: datetime
    tool_name: str
    arguments: Optional[Dict[str, Any]]
    environment: str
    risk_score: float
    risk_explanation: Optional[str]

    class Config:
        from_attributes = True

# Audit Log Schemas
class AuditLogResponse(BaseModel):
    id: UUID
    timestamp: datetime
    client_name: str
    tool_name: str
    arguments_hash: Optional[str]
    risk_score: Optional[float]
    status: str
    approved_by_email: Optional[str] = None
    row_hash: str

    class Config:
        from_attributes = True

# Rollback Schemas
class RollbackResponse(BaseModel):
    id: UUID
    execution_id: UUID
    snapshot_type: str
    snapshot_target: str
    created_at: datetime
    is_rolled_back: bool
    rolled_back_at: Optional[datetime]

    class Config:
        from_attributes = True
