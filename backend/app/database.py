from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Create engine
engine = create_engine(
    settings.DATABASE_URL,
    # pool_pre_ping checks connections before checking them out from pool
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency helper to inject DB sessions into route handlers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
