from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, Dict, List # <--- FIX: ADDED 'List'
from pydantic import BaseModel # Must import BaseModel for the classes below

from ..db.database import get_db
from ..db import crud
from ..models import schemas
from ..core.security import verify_password, get_password_hash
from ..core.auth_utils import get_current_user
# Note: Token creation logic is simplified/omitted here for brevity, but would be handled by security.py

router = APIRouter(
    prefix="/auth",
    tags=["Auth & Users"]
)

# --- Pydantic Schemas for Auth Requests/Responses ---

class UserAuth(BaseModel):
    email: str
    password: str
    
class InitialSignup(BaseModel):
    company_name: str
    email: str
    password: str
    name: str = "Admin"  # Default name for admin user
    currency: str  # Currency code for the new company

class Token(BaseModel):
    access_token: str
    token_type: str
    user: schemas.User # Include user details in the response
class AdminUserCreate(schemas.UserCreate):
    password: str
    role: str # Must be provided by Admin (Employee or Manager)
    manager_id: Optional[int] = None # Optional manager assignment
    is_manager_approver: bool = False # Used for manager approval flow
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
            currency_code=signup_data.currency
        )
    except Exception as e:
        # Handle database errors
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create initial account: {e}")

    # 2. Authentication Successful - Generate Token (Placeholder)
    access_token = "MOCK_ADMIN_TOKEN_" + str(db_user.user_id)

    # Create response with user data
    user_dict = {
        "user_id": db_user.user_id,
        "company_id": db_user.company_id,
        "email": db_user.email,
        "name": db_user.name,
        "role": db_user.role,
        "manager_id": db_user.manager_id,
        "is_manager_approver": db_user.is_manager_approver
    }
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": user_dict
    }


@router.post("/login", response_model=Token)
def login_for_access_token(user_credentials: UserAuth, db: Session = Depends(get_db)):
    """
    Authenticates a user and returns an access token.
    """
    db_user = crud.get_user_by_email(db, email=user_credentials.email)
    
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(user_credentials.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Authentication Successful - Generate Token (Placeholder)
    access_token = "MOCK_TOKEN_" + str(db_user.user_id)

    # Create response with user data
    user_dict = {
        "user_id": db_user.user_id,
        "company_id": db_user.company_id,
        "email": db_user.email,
        "name": db_user.name,
        "role": db_user.role,
        "manager_id": db_user.manager_id,
        "is_manager_approver": db_user.is_manager_approver
    }

    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": user_dict
    }

@router.post("/users", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def admin_create_user(
    user_data: AdminUserCreate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to create new user accounts (Employee or Manager) 
    within the Admin's company.
    """
    
    # 1. Verification: Ensure the requesting user is an Admin
    admin_user = db.query(crud.models.User).filter(crud.models.User.user_id == user_id).first()
    
    if not admin_user or admin_user.role != 'Admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin users can create new accounts."
        )

    # 2. Validation: Prevent Admin from creating another Admin or unknown role
    if user_data.role not in ['Employee', 'Manager']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role specified. Must be 'Employee' or 'Manager'."
        )

    # 3. Check if user already exists
    if crud.get_user_by_email(db, email=user_data.email):
         raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists."
        )

    # 4. Create the new user
    hashed_password = get_password_hash(user_data.password)
    
    # Enhanced debug logging
    print("\n" + "="*60)
    print("🔧 ADMIN USER CREATION DEBUG")
    print("="*60)
    print(f"Admin User ID: {admin_user.user_id}")
    print(f"Admin Company ID: {admin_user.company_id}")
    print(f"New User Data:")
    print(f"  - Name: {user_data.name}")
    print(f"  - Email: {user_data.email}")
    print(f"  - Role: {user_data.role}")
    print(f"  - Manager ID: {user_data.manager_id}")
    print(f"  - Is Manager Approver: {user_data.is_manager_approver}")
    print(f"  - Password Hash Length: {len(hashed_password)}")
    print("="*60)
    
    try:
        new_user = crud.create_user(
            db=db, 
            user=user_data, 
            company_id=admin_user.company_id,
            hashed_password=hashed_password,
            manager_id=user_data.manager_id
        )
        
        print(f"✅ User created successfully!")
        print(f"   - User ID: {new_user.user_id}")
        print(f"   - Company ID: {new_user.company_id}")
        print(f"   - Manager ID: {new_user.manager_id}")
        print(f"   - Approval Rule ID: {new_user.approval_rule_id}")
        print("="*60 + "\n")
        
        return new_user
        
    except Exception as e:
        print(f"❌ Error creating user: {e}")
        print("="*60 + "\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

# --- Endpoint to get list of potential Managers ---
@router.get("/managers", response_model=List[schemas.User])
def get_potential_managers(
    user_id: int = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to retrieve a list of ALL USERS (Admin, Manager, Employee) 
    within the company to be assigned as managers or required approvers.
    """
    # ... (admin verification logic remains the same)
    admin_user = db.query(crud.models.User).filter(crud.models.User.user_id == user_id).first()
    
    if not admin_user or admin_user.role != 'Admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    
    # Use the CRUD function to fetch ALL users as manager candidates
    managers = crud.get_all_company_manager_candidates(db, company_id=admin_user.company_id) # <--- UPDATED CALL
    
    return managers

# --- Endpoint for Admin to Update a User (e.g., assign rule/manager) ---
@router.put("/users/{user_id}", response_model=schemas.User)
def admin_update_user(
    user_id: int,  # Changed parameter name to avoid confusion
    user_data: schemas.UserUpdate,
    admin_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to update user details, including role, manager, 
    and linking an Approval Rule.
    """
    admin_user = db.query(crud.models.User).filter(crud.models.User.user_id == admin_id).first()
    
    if not admin_user or admin_user.role != 'Admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only Admin users can update accounts."
        )

    user = db.query(crud.models.User).filter(crud.models.User.user_id == user_id).first()
    
    if not user or user.company_id != admin_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found or not in your company."
        )

    # Log the update data
    print(f"\n{'='*60}")
    print(f"UPDATING USER {user_id}")
    print(f"{'='*60}")
    print(f"Admin: {admin_user.name} (ID: {admin_id})")
    print(f"Target User: {user.name} (ID: {user_id})")
    print(f"Update Data: {user_data.model_dump(exclude_unset=True)}")
    print(f"{'='*60}\n")

    # Apply updates from user_data Pydantic model
    update_data = user_data.model_dump(exclude_unset=True)
    
    # Update fields manually
    for key, value in update_data.items():
        if key != 'email':  # Do not allow email update via this endpoint
            setattr(user, key, value)
            print(f"Updated {key} = {value}")

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        
        print(f"✅ User {user_id} updated successfully")
        print(f"   Approval Rule ID: {user.approval_rule_id}\n")
        
        return user
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error updating user: {e}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user: {str(e)}"
        )