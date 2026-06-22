from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Boolean, Text, JSON
from sqlalchemy.orm import relationship
import uuid
import datetime
from .database import Base

# Helper to generate UUID strings for SQLite compatibility
def generate_uuid():
    return str(uuid.uuid4())

class Role(Base):
    __tablename__ = "roles"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(50), unique=True, nullable=False) # e.g. superadmin, admin, operator, reader
    description = Column(String(255))
    
    users = relationship("User", back_populates="role")
    clients = relationship("ClientRegistry", back_populates="role")
    policies = relationship("PolicyRule", back_populates="role")

class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role_id = Column(String(36), ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    role = relationship("Role", back_populates="users")
    approvals = relationship("ApprovalRequest", back_populates="approver")

class ClientRegistry(Base):
    __tablename__ = "mcp_clients"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False) # e.g. "Claude-Production"
    api_token_hash = Column(String(255), unique=True, nullable=False)
    role_id = Column(String(36), ForeignKey("roles.id"), nullable=False)
    ip_whitelist = Column(Text, nullable=True) # CSV of allowed IPs/CIDRs
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_active = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    role = relationship("Role", back_populates="clients")
    executions = relationship("ToolExecution", back_populates="client")

class MCPTool(Base):
    __tablename__ = "mcp_tools"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False) # e.g. "restart_service"
    category = Column(String(50), nullable=False) # system, package, service, docker, etc.
    description = Column(Text)
    base_risk = Column(Float, default=1.0)
    requires_approval_above = Column(Float, default=5.0)
    rollback_available = Column(Boolean, default=False)

    executions = relationship("ToolExecution", back_populates="tool")
    policies = relationship("PolicyRule", back_populates="tool")

class PolicyRule(Base):
    __tablename__ = "policies"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    role_id = Column(String(36), ForeignKey("roles.id"), nullable=False)
    tool_id = Column(String(36), ForeignKey("mcp_tools.id"), nullable=False)
    environment = Column(String(50), default="*") # *, production, staging, development
    effect = Column(String(20), nullable=False) # allow, deny, approval_required
    rules_json = Column(JSON, nullable=True) # Context-aware rules

    role = relationship("Role", back_populates="policies")
    tool = relationship("MCPTool", back_populates="policies")

class ToolExecution(Base):
    __tablename__ = "tool_executions"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    client_id = Column(String(36), ForeignKey("mcp_clients.id"), nullable=False)
    tool_id = Column(String(36), ForeignKey("mcp_tools.id"), nullable=False)
    arguments = Column(JSON, nullable=True)
    environment = Column(String(50), nullable=False)
    status = Column(String(50), default="PENDING") # PENDING_APPROVAL, EXECUTING, COMPLETED, FAILED, REJECTED
    exit_code = Column(Integer, nullable=True)
    stdout = Column(Text, nullable=True)
    stderr = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    client = relationship("ClientRegistry", back_populates="executions")
    tool = relationship("MCPTool", back_populates="executions")
    approval = relationship("ApprovalRequest", back_populates="execution", uselist=False)
    risk_assessment = relationship("RiskAssessment", back_populates="execution", uselist=False)
    rollback = relationship("RollbackSnapshot", back_populates="execution", uselist=False)

class ApprovalRequest(Base):
    __tablename__ = "approvals"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    execution_id = Column(String(36), ForeignKey("tool_executions.id"), nullable=False)
    status = Column(String(50), default="PENDING") # PENDING, APPROVED, REJECTED, EXPIRED
    reason = Column(Text, nullable=True)
    approver_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    execution = relationship("ToolExecution", back_populates="approval")
    approver = relationship("User", back_populates="approvals")

class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    execution_id = Column(String(36), ForeignKey("tool_executions.id"), nullable=False)
    risk_score = Column(Float, nullable=False)
    explanation = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    execution = relationship("ToolExecution", back_populates="risk_assessment")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    client_id = Column(String(36), ForeignKey("mcp_clients.id"), nullable=False)
    tool_name = Column(String(100), nullable=False)
    arguments_hash = Column(String(64)) # SHA256 of args payload
    risk_score = Column(Float)
    approved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    status = Column(String(50))
    previous_hash = Column(String(64), nullable=False)
    row_hash = Column(String(64), nullable=False)

class RollbackSnapshot(Base):
    __tablename__ = "rollback_snapshots"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    execution_id = Column(String(36), ForeignKey("tool_executions.id"), nullable=False)
    snapshot_type = Column(String(50)) # docker_image, postgres_dump, git_commit, directory_backup
    snapshot_target = Column(String(255)) # path or docker image tag
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_rolled_back = Column(Boolean, default=False)
    rolled_back_at = Column(DateTime, nullable=True)
    
    execution = relationship("ToolExecution", back_populates="rollback")
