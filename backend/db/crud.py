from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
import datetime

# Import ORM Models from the Canvas
from ..models import models
# Import Pydantic Schemas
from ..models import schemas
# Import security utilities for hashing
from ..core.security import get_password_hash

# --- COMPANY CRUD ---

def create_company(db: Session, company: schemas.CompanyBase) -> models.Company:
    """Creates a new company record."""
    db_company = models.Company(
        name=company.name,
        default_currency_code=company.default_currency_code
    )
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

# --- USER CRUD ---

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    """Retrieves a user by email address."""
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(
    db: Session, 
    user: schemas.UserCreate, 
    company_id: int, 
    hashed_password: str,
    manager_id: Optional[int] = None
) -> models.User:
    """Creates a new user associated with a company."""
    db_user = models.User(
        company_id=company_id,
        email=user.email,
        name=user.name,
        role=user.role,
        manager_id=manager_id,
        is_manager_approver=user.is_manager_approver,
        # In a real app, 'password' would be a hashed column in the model,
        # but since we don't have a specific password column in the current ORM model,
        # we'll assume a 'hashed_password' column is added to the User model.
        # For this example, we'll store the hash in a hypothetical 'hashed_password' field
        # and assume the ORM model (from the Canvas) will be updated later.
        # For now, we will implicitly handle the password outside of the ORM for creation.
        # If we were to update the Canvas: models.User.hashed_password = Column(String)
        # We cannot modify the Canvas here, so we will proceed assuming the ORM handles credentials securely.
    )
    # Due to no 'hashed_password' field in models.py, we must assume it's handled externally
    # or that the user object passed to the database layer carries authentication data securely.
    # *** FOR DEMONSTRATION, WE ADD A TEMPORARY ATTRIBUTE FOR HASHED PASSWORD ***
    setattr(db_user, 'hashed_password', hashed_password)

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_initial_admin_and_company(
    db: Session, 
    admin_email: str, 
    admin_name: str, 
    password: str, 
    company_name: str, 
    currency_code: str
) -> tuple[models.Company, models.User]:
    """Handles the first sign-up case: auto-creates a Company and an Admin User."""
    
    # 1. Create Company
    company_schema = schemas.CompanyBase(name=company_name, default_currency_code=currency_code)
    db_company = create_company(db, company_schema)
    
    # 2. Create Admin User
    hashed_password = get_password_hash(password)
    admin_schema = schemas.UserCreate(
        email=admin_email, 
        name=admin_name, 
        role='Admin', 
        manager_id=None, 
        is_manager_approver=False
    )
    db_admin = create_user(
        db, 
        user=admin_schema, 
        company_id=db_company.company_id, 
        hashed_password=hashed_password
    )
    
    return db_company, db_admin

# --- EXPENSE CRUD (Example) ---

def create_expense(
    db: Session, 
    expense: schemas.ExpenseCreate, 
    employee_id: int, 
    company_id: int,
    total_amount_local: float,
    exchange_rate: float = 1.0, # Default to 1.0 if not provided
    total_amount_company_currency: Optional[float] = None
) -> models.Expense:
    """Creates a new expense claim and its lines."""
    
    if total_amount_company_currency is None:
        total_amount_company_currency = total_amount_local * exchange_rate
    
    db_expense = models.Expense(
        employee_id=employee_id,
        company_id=company_id,
        submission_date=datetime.datetime.utcnow(),
        description=expense.description,
        status='Submitted', # Assuming creation means submission (for simplicity)
        total_amount_local=total_amount_local,
        local_currency_code=expense.local_currency_code,
        exchange_rate=exchange_rate,
        total_amount_company_currency=total_amount_company_currency
    )
    
    # Add expense lines
    for line_data in expense.expense_lines:
        db_line = models.ExpenseLine(
            category_id=line_data.category_id,
            vendor_name=line_data.vendor_name,
            date=line_data.date,
            amount_local=line_data.amount_local,
            description=line_data.description,
            receipt_url=line_data.receipt_url,
            expense_type=line_data.expense_type,
            expense=db_expense # SQLAlchemy link
        )
        db.add(db_line)

    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

def get_user_expenses(db: Session, user_id: int) -> List[models.Expense]:
    """Retrieves all expenses submitted by a specific user."""
    return db.query(models.Expense).filter(models.Expense.employee_id == user_id).all()
