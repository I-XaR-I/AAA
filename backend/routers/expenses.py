from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from ..db.database import get_db
from ..db import crud
from ..models import schemas
from ..core.auth_utils import get_current_user # Import the new utility

router = APIRouter(
    prefix="/expenses",
    tags=["Expenses"]
)

# Add this Pydantic model for the request body
class ApprovalComments(BaseModel):
    comments: Optional[str] = None

@router.get("/", response_model=List[schemas.Expense])
def read_user_expenses(
    user_id: int = Depends(get_current_user), # Use the dependency to get authenticated user's ID
    db: Session = Depends(get_db)
):
    """
    Retrieves a list of all expenses submitted by the authenticated employee.
    (Required feature for Employee Role: View their expense history).
    """
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed."
        )

    # Use the CRUD function to fetch expenses for the current user ID
    expenses = crud.get_user_expenses(db, user_id=user_id)
    
    if not expenses:
        # Return an empty list instead of 404 if user has no expenses
        return []

    return expenses

@router.post("/", response_model=schemas.Expense, status_code=status.HTTP_201_CREATED)
def create_expense_claim(
    expense_data: schemas.ExpenseCreate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new expense claim.
    Available to all authenticated users (Admin, Manager, Employee).
    """
    user = db.query(crud.models.User).filter(crud.models.User.user_id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Get company to access default currency
    company = db.query(crud.models.Company).filter(
        crud.models.Company.company_id == user.company_id
    ).first()
    
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    
    # Calculate total amount
    total_amount = sum(line.amount_local for line in expense_data.expense_lines)
    
    print(f"\n{'='*60}")
    print(f"Creating expense for {user.name}")
    print(f"Local currency: {expense_data.local_currency_code}")
    print(f"Company currency: {company.default_currency_code}")
    print(f"Total amount (local): {total_amount}")
    print(f"{'='*60}\n")
    
    # Create expense - currency conversion handled inside crud.create_expense
    new_expense = crud.create_expense(
        db=db,
        expense=expense_data,
        employee_id=user_id,
        company_id=user.company_id,
        total_amount_local=total_amount,
        exchange_rate=1.0  # Will be calculated in create_expense
    )
    
    return new_expense

@router.get("/pending-approvals", response_model=List[schemas.Expense])
def get_pending_approvals(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all expenses pending approval by the current user.
    Available to all users (Employee, Manager, and Admin can all approve).
    """
    user = db.query(crud.models.User).filter(crud.models.User.user_id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get company details for currency
    company = db.query(crud.models.Company).filter(
        crud.models.Company.company_id == user.company_id
    ).first()
    
    print(f"Fetching pending approvals for user {user.name} (ID: {user_id}, Role: {user.role})")
    print(f"Company currency: {company.default_currency_code if company else 'Unknown'}")
    
    pending = crud.get_pending_approvals_for_user(db, user_id)
    
    # Debug: Log exchange rates
    for expense in pending:
        print(f"Expense {expense.expense_id}: {expense.local_currency_code} -> {company.default_currency_code if company else 'N/A'}, Rate: {expense.exchange_rate}")
    
    print(f"Found {len(pending)} pending approvals for user {user_id}")
    
    return pending

@router.post("/{expense_id}/approve")
def approve_expense(
    expense_id: int,
    body: ApprovalComments,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve an expense. Available to all users who are designated as approvers."""
    user = db.query(crud.models.User).filter(crud.models.User.user_id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if this expense is actually pending for this user
    expense = db.query(crud.models.Expense).filter(
        crud.models.Expense.expense_id == expense_id
    ).first()
    
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    # Verify user is authorized to approve this expense
    pending_for_user = crud.get_pending_approvals_for_user(db, user_id)
    if expense not in pending_for_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to approve this expense at this time"
        )
    
    approval = crud.create_expense_approval(
        db=db,
        expense_id=expense_id,
        approver_id=user_id,
        status='Approved',
        comments=body.comments
    )
    
    return {"message": "Expense approved successfully", "approval_id": approval.approval_id}

@router.post("/{expense_id}/reject")
def reject_expense(
    expense_id: int,
    body: ApprovalComments,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject an expense. Available to all users who are designated as approvers."""
    user = db.query(crud.models.User).filter(crud.models.User.user_id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get comments from request body
    comments = body.comments
    
    # Debug logging
    print(f"\n{'='*60}")
    print(f"REJECT EXPENSE REQUEST")
    print(f"{'='*60}")
    print(f"Expense ID: {expense_id}")
    print(f"User ID: {user_id}")
    print(f"Request body: {body}")
    print(f"Comments from body: '{comments}'")
    print(f"Comments type: {type(comments)}")
    print(f"Comments is None: {comments is None}")
    if comments:
        print(f"Comments stripped: '{comments.strip()}'")
        print(f"Comments length after strip: {len(comments.strip())}")
    print(f"{'='*60}\n")
    
    # Check if comments is provided and not empty after stripping
    if not comments or (isinstance(comments, str) and comments.strip() == ''):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comments are required when rejecting an expense"
        )
    
    # Check if this expense is actually pending for this user
    expense = db.query(crud.models.Expense).filter(
        crud.models.Expense.expense_id == expense_id
    ).first()
    
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    # Verify user is authorized to reject this expense
    pending_for_user = crud.get_pending_approvals_for_user(db, user_id)
    if expense not in pending_for_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to reject this expense at this time"
        )
    
    approval = crud.create_expense_approval(
        db=db,
        expense_id=expense_id,
        approver_id=user_id,
        status='Rejected',
        comments=comments.strip()  # Strip whitespace before saving
    )
    
    return {"message": "Expense rejected", "approval_id": approval.approval_id}