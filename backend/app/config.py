import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "SAFEOPS MCP API"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development") # development, staging, production
    
    # Database Settings
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./safeops.db"
    )
    
    # Redis Settings
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    
    # Security Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-safeops-token-key-change-in-production-1234567890")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # Governance settings
    RISK_THRESHOLD_AUTO_EXECUTE: float = 3.0
    RISK_THRESHOLD_MANAGER_APPROVAL: float = 7.0 # >= 3.0 and < 7.0 triggers manager, >= 7.0 triggers admin
    
    # Sandbox Settings
    SANDBOX_DOCKER_IMAGE: str = os.getenv("SANDBOX_DOCKER_IMAGE", "alpine:latest")
    SANDBOX_TIMEOUT_SECONDS: int = 30
    
    class Config:
        case_sensitive = True

settings = Settings()
