from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine, Base, SessionLocal
from .models import Role, User
from .core.auth_utils import get_password_hash
from .routers import auth, clients, tools, policies, executions, approvals, audit, rollbacks

# Initialize database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise-Grade Secure Systems Governance Platform MCP backend.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Adjust in production to fit dashboard host url
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(clients.router, prefix="/api/v1")
app.include_router(tools.router, prefix="/api/v1")
app.include_router(policies.router, prefix="/api/v1")
app.include_router(executions.router, prefix="/api/v1")
app.include_router(approvals.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(rollbacks.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT
    }

# Startup Event: Seed Default Roles and SuperAdmin user
@app.on_event("startup")
def seed_database():
    db = SessionLocal()
    try:
        # 1. Seed Roles
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

        # 2. Seed default SuperAdmin User for dashboard login
        admin_email = "admin@safeops.io"
        admin_user = db.query(User).filter(User.email == admin_email).first()
        if not admin_user:
            superadmin_role = role_map["superadmin"]
            admin_user = User(
                email=admin_email,
                hashed_password=get_password_hash("safeops-password-change-me"),
                role_id=superadmin_role.id
            )
            db.add(admin_user)
            db.commit()
            print(f"[SafeOps Startup] Seeding default administrator: {admin_email} (password: 'safeops-password-change-me')")
            
    except Exception as e:
        print(f"[SafeOps Startup Warning] DB seeding failed: {str(e)}")
        db.rollback()
    finally:
        db.close()
