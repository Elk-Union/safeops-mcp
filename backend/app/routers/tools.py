from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..schemas import ToolResponse
from ..models import MCPTool, ClientRegistry, User, PolicyRule
from ..core.auth_utils import get_current_client, get_current_user

router = APIRouter(prefix="/tools", tags=["Tools Catalog"])

# Endpoint consumed by the MCP server to dynamically build tools schemas
@router.get("/client-catalog", response_model=List[ToolResponse])
def get_client_tools_catalog(
    db: Session = Depends(get_db),
    client: ClientRegistry = Depends(get_current_client)
):
    # Retrieve tools governed by 'allow' or 'approval_required' policies for the client's role
    allowed_tool_ids = db.query(PolicyRule.tool_id).filter(
        PolicyRule.role_id == client.role_id,
        PolicyRule.effect.in_(["allow", "approval_required"])
    ).subquery()
    
    return db.query(MCPTool).filter(MCPTool.id.in_(allowed_tool_ids)).all()

# Endpoint for Dashboard user view
@router.get("/", response_model=List[ToolResponse])
def list_all_tools(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(MCPTool).all()

# Seed tools if catalog is empty
@router.post("/seed", response_model=List[ToolResponse])
def seed_default_tools(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(MCPTool).count()
    if existing > 0:
        return db.query(MCPTool).all()
        
    default_tools = [
        # System
        {"name": "get_uptime", "category": "system", "description": "Gets system uptime.", "base_risk": 1.0, "requires_approval_above": 5.0, "rollback_available": False},
        {"name": "cpu_usage", "category": "system", "description": "Gets real-time CPU utilization metrics.", "base_risk": 1.0, "requires_approval_above": 5.0, "rollback_available": False},
        {"name": "ram_usage", "category": "system", "description": "Gets memory utilization metrics.", "base_risk": 1.0, "requires_approval_above": 5.0, "rollback_available": False},
        {"name": "disk_usage", "category": "system", "description": "Gets disk space partition metrics.", "base_risk": 1.0, "requires_approval_above": 5.0, "rollback_available": False},
        {"name": "system_health", "category": "system", "description": "Combined health diagnostic (CPU, RAM, Disk, Load).", "base_risk": 1.0, "requires_approval_above": 5.0, "rollback_available": False},
        
        # Packages
        {"name": "check_updates", "category": "packages", "description": "Check for available package updates.", "base_risk": 2.0, "requires_approval_above": 5.0, "rollback_available": False},
        {"name": "update_package", "category": "packages", "description": "Upgrades/installs a specific package.", "base_risk": 5.0, "requires_approval_above": 5.0, "rollback_available": True},
        {"name": "remove_package", "category": "packages", "description": "Uninstalls a package.", "base_risk": 7.0, "requires_approval_above": 5.0, "rollback_available": True},
        {"name": "package_info", "category": "packages", "description": "Shows package metadata.", "base_risk": 1.0, "requires_approval_above": 5.0, "rollback_available": False},
        
        # Services
        {"name": "start_service", "category": "services", "description": "Starts a systemd or docker service.", "base_risk": 4.0, "requires_approval_above": 5.0, "rollback_available": True},
        {"name": "stop_service", "category": "services", "description": "Stops a systemd or docker service.", "base_risk": 6.0, "requires_approval_above": 5.0, "rollback_available": True},
        {"name": "restart_service", "category": "services", "description": "Restarts a systemd or docker service.", "base_risk": 5.0, "requires_approval_above": 5.0, "rollback_available": True},
        {"name": "service_status", "category": "services", "description": "Returns systemd or docker service details.", "base_risk": 1.0, "requires_approval_above": 5.0, "rollback_available": False},
        
        # Setup Pipeline tools
        {"name": "traverse_documentation", "category": "setup", "description": "Safely fetches and parses online application setup documentation, converting it to markdown text.", "base_risk": 2.0, "requires_approval_above": 5.0, "rollback_available": False},
        {"name": "simulate_install", "category": "setup", "description": "Dry-runs application installation commands inside an isolated Docker sandbox matching the host OS to check for compatibility and errors.", "base_risk": 4.0, "requires_approval_above": 5.0, "rollback_available": False}
    ]
    
    db_tools = []
    for tool_data in default_tools:
        tool = MCPTool(**tool_data)
        db.add(tool)
        db_tools.append(tool)
        
    db.commit()
    return db_tools
