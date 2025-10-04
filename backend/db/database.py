from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Generator
from ..models.models import Base # Import Base from our models file

# SQLite URL is relative to the project root.
# For production, you might use a more robust DB like PostgreSQL.
SQLITE_DATABASE_URL = "sqlite:///./backend/expense_management.db"

# Setting connect_args={"check_same_thread": False} is required for SQLite
# when using it with FastAPI because FastAPI runs multiple threads.
engine = create_engine(
    SQLITE_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator:
    """Dependency to yield a new database session for each request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initializes the database by creating all tables defined in Base."""
    # This automatically calls CREATE TABLE statements based on the ORM models
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")

def reset_db():
    """Drops all tables and recreates them. USE WITH CAUTION - DELETES ALL DATA!"""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database reset successfully. All tables recreated.")

# Run init_db() on application startup (will be called from main.py)
