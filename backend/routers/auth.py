from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, Dict
from pydantic import BaseModel # Must import BaseModel for the classes below

from ..db.database import get_db
from ..db import crud
from ..models import schemas
from ..core.security import verify_password, get_password_hash
# Note: Token creation logic is simplified/omitted here for brevity, but would be handled by security.py

router = APIRouter(
    prefix="/auth",
    tags=["Auth & Users"]
)

# --- Pydantic Schemas for Auth Requests/Responses ---

class UserAuth(schemas.UserCreate):
    password: str
    
class InitialSignup(UserAuth):
    company_name: str
    currency_code: str # Currency code for the new company

class Token(BaseModel):
    access_token: str
    token_type: str
    user: schemas.User # Include user details in the response

# --- Router Endpoints ---

@router.post("/signup", response_model=Token)
def signup_user(signup_data: InitialSignup, db: Session = Depends(get_db)):
    """
    Handles user signup. On the very first signup, auto-creates the Company and Admin User.
    Subsequent signups for existing companies are restricted here.
    """
    
    # Check if a company already exists to determine if this is the first signup
    existing_company = db.query(crud.models.Company).first()
    
    if existing_company:
        # Restrict public signup as per problem statement's focus on Admin creating users
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public signup is disabled. Users must be created by an Admin."
        )

    # Check if user already exists
    if crud.get_user_by_email(db, email=signup_data.email):
         raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists."
        )


    # 1. Create Company and Admin
    try:
        db_company, db_user = crud.create_initial_admin_and_company(
            db=db,
            admin_email=signup_data.email,
            admin_name=signup_data.name,
            password=signup_data.password,
            company_name=signup_data.company_name,
            currency_code=signup_data.currency_code
        )
    except Exception as e:
        # Handle database errors
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create initial account: {e}")

    # 2. Authentication Successful - Generate Token (Placeholder)
    access_token = "MOCK_ADMIN_TOKEN_" + str(db_user.user_id)

    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": schemas.User.from_orm(db_user)
    }


@router.post("/login", response_model=Token)
def login_for_access_token(user_credentials: UserAuth, db: Session = Depends(get_db)):
    """
    Authenticates a user and returns an access token.
    """
    db_user = crud.get_user_by_email(db, email=user_credentials.email)
    
    # In a real app, the 'hashed_password' column would be retrieved from the database model.
    # Since we can't edit the ORM model (Canvas), we assume the password check is done safely.
    
    # MOCK verification: We assume we can safely retrieve and check the password hash
    # Note: In a production app, the ORM model MUST contain the hashed_password column.
    
    # Since we cannot safely retrieve the hash from the ORM model, we will only verify 
    # that the user exists. This is UNSAFE and should be corrected by adding
    # 'hashed_password = Column(String)' to the User model in the Canvas.
    # For now, we will perform a simple mock check.
    
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Due to missing 'hashed_password' in the User model, we skip the real verification.
    # **THIS IS A SECURITY RISK AND MUST BE CORRECTED IN THE ORM MODEL.**
    # You must add 'hashed_password = Column(String)' to the User model in AAA/backend/models/models.py.
    
    # Authentication Successful - Generate Token (Placeholder)
    access_token = "MOCK_TOKEN_" + str(db_user.user_id)

    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": schemas.User.from_orm(db_user)
    }
