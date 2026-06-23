import os
import sys
import secrets

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base, SessionLocal
from app.models import Role, User, MCPTool, ClientRegistry, PolicyRule
from app.core.auth_utils import get_password_hash, hash_token

def init_system():
    print("Initializing SafeOps database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. Seed Roles
        print("Seeding default security roles...")
        default_roles = ["superadmin", "admin", "operator", "reader"]
        role_map = {}
        for role_name in default_roles:
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                role = Role(
                    name=role_name,
                    description=f"Default role for {role_name} permissions context."
                )
                db.add(role)
                db.flush()
            role_map[role_name] = role
        db.commit()

        # 2. Seed default SuperAdmin User
        print("Seeding default administrator user...")
        admin_email = "admin@safeops.io"
        admin_user = db.query(User).filter(User.email == admin_email).first()
        if not admin_user:
            superadmin_role = role_map["superadmin"]
            admin_user = User(
                email=admin_email,
                hashed_password=get_password_hash("safeops-admin"),
                role_id=superadmin_role.id
            )
            db.add(admin_user)
            db.commit()

        # 3. Seed Tools Catalog
        print("Seeding tools catalog...")
        existing_tools_count = db.query(MCPTool).count()
        if existing_tools_count == 0:
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
                {"name": "pacman_package", "category": "packages", "description": "Manages system packages via pacman package manager on Arch Linux host.", "base_risk": 8.0, "requires_approval_above": 5.0, "rollback_available": True},
                # Services
                {"name": "start_service", "category": "services", "description": "Starts a systemd or docker service.", "base_risk": 4.0, "requires_approval_above": 5.0, "rollback_available": True},
                {"name": "stop_service", "category": "services", "description": "Stops a systemd or docker service.", "base_risk": 6.0, "requires_approval_above": 5.0, "rollback_available": True},
                {"name": "restart_service", "category": "services", "description": "Restarts a systemd or docker service.", "base_risk": 5.0, "requires_approval_above": 5.0, "rollback_available": True},
                {"name": "service_status", "category": "services", "description": "Returns systemd or docker service details.", "base_risk": 1.0, "requires_approval_above": 5.0, "rollback_available": False},
                # Setup Pipeline tools
                {"name": "traverse_documentation", "category": "setup", "description": "Safely fetches and parses online application setup documentation, converting it to markdown text.", "base_risk": 2.0, "requires_approval_above": 5.0, "rollback_available": False},
                {"name": "simulate_install", "category": "setup", "description": "Dry-runs application installation commands inside an isolated Docker sandbox matching the host OS to check for compatibility and errors.", "base_risk": 4.0, "requires_approval_above": 5.0, "rollback_available": False},
                {"name": "lookup_package_doc", "category": "setup", "description": "Searches online for installation and configuration documentation of a specific package (e.g. PyPI, npm, GitHub) and returns the parsed markdown setup instructions.", "base_risk": 2.0, "requires_approval_above": 5.0, "rollback_available": False}
            ]
            for tool_data in default_tools:
                tool = MCPTool(**tool_data)
                db.add(tool)
            db.commit()

        # 4. Create default policies for the operator role so tools are allowed out of the box
        print("Creating default access policies for operator role...")
        operator_role = role_map["operator"]
        all_tools = db.query(MCPTool).all()
        for tool in all_tools:
            existing_policy = db.query(PolicyRule).filter(
                PolicyRule.role_id == operator_role.id,
                PolicyRule.tool_id == tool.id
            ).first()
            if not existing_policy:
                policy = PolicyRule(
                    role_id=operator_role.id,
                    tool_id=tool.id,
                    environment="*",
                    effect="allow"
                )
                db.add(policy)
        db.commit()

        # 5. Register default Client Agent
        print("Registering default operator agent key...")
        client_name = "Default Agent"
        client = db.query(ClientRegistry).filter(ClientRegistry.name == client_name).first()
        
        if not client:
            api_token = f"so_tok_{secrets.token_hex(24)}"
            token_hash = hash_token(api_token)
            
            client = ClientRegistry(
                name=client_name,
                api_token_hash=token_hash,
                role_id=operator_role.id,
                ip_whitelist=None
            )
            db.add(client)
            db.commit()
            print("\n" + "="*80)
            print("Initialization Complete! Default Agent successfully registered.")
            print(f"API Token: {api_token}")
            print("="*80 + "\n")
        else:
            print("Default agent already registered.")
            
    except Exception as e:
        print(f"Error during system initialization: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_system()
