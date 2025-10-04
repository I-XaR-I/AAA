from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
import datetime
import requests
from typing import Dict

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
    
    # Get manager_id from user data if not explicitly provided
    if manager_id is None and hasattr(user, 'manager_id'):
        manager_id = user.manager_id
    
    # Get is_manager_approver flag
    is_manager_approver = getattr(user, 'is_manager_approver', False)
    
    db_user = models.User(
        company_id=company_id,
        email=user.email,
        name=user.name,
        role=user.role,
        manager_id=manager_id,
        is_manager_approver=is_manager_approver,
        hashed_password=hashed_password
    )
    
    # Debug logging
    print(f"CRUD: Creating user with manager_id={manager_id}, is_manager_approver={is_manager_approver}")
    
    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        print(f"CRUD: User created successfully - ID: {db_user.user_id}, Manager: {db_user.manager_id}")
        return db_user
    except IntegrityError as e:
        db.rollback()
        print(f"CRUD: Database integrity error: {e}")
        raise
    except Exception as e:
        db.rollback()
        print(f"CRUD: Unexpected error during user creation: {e}")
        raise

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

def get_exchange_rate(from_currency: str, to_currency: str) -> float:
    """Fetch exchange rate from external API."""
    if from_currency == to_currency:
        return 1.0
    
    try:
        # Using the specified API format
        url = f"https://api.exchangerate-api.com/v4/latest/{from_currency}"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            rates = data.get('rates', {})
            
            if to_currency in rates:
                rate = rates[to_currency]
                print(f"Exchange rate fetched: 1 {from_currency} = {rate} {to_currency}")
                return rate
            else:
                print(f"Warning: {to_currency} not found in rates, using 1.0")
                return 1.0
        else:
            print(f"Warning: API returned status {response.status_code}, using 1.0")
            return 1.0
        
    except requests.exceptions.Timeout:
        print(f"Error: Exchange rate API timeout, using 1.0")
        return 1.0
    except Exception as e:
        print(f"Error fetching exchange rate: {e}, using 1.0")
        return 1.0

def create_expense(
    db: Session, 
    expense: schemas.ExpenseCreate, 
    employee_id: int, 
    company_id: int,
    total_amount_local: float,
    exchange_rate: float = 1.0,
    total_amount_company_currency: Optional[float] = None
) -> models.Expense:
    """Creates a new expense claim and its lines."""
    
    # Get employee's details and company's currency
    employee = db.query(models.User).filter(models.User.user_id == employee_id).first()
    company = db.query(models.Company).filter(models.Company.company_id == company_id).first()
    
    if not company:
        raise ValueError("Company not found")
    
    # Fetch exchange rate if currencies are different
    if expense.local_currency_code != company.default_currency_code:
        exchange_rate = get_exchange_rate(expense.local_currency_code, company.default_currency_code)
        total_amount_company_currency = total_amount_local * exchange_rate
        print(f"Currency conversion: {total_amount_local} {expense.local_currency_code} = {total_amount_company_currency:.2f} {company.default_currency_code} (rate: {exchange_rate})")
    else:
        exchange_rate = 1.0
        total_amount_company_currency = total_amount_local
        print(f"Same currency: {total_amount_local} {expense.local_currency_code}")
    
    # Check if employee is Admin - auto-approve
    if employee and employee.role == 'Admin':
        db_expense = models.Expense(
            employee_id=employee_id,
            company_id=company_id,
            submission_date=datetime.datetime.utcnow(),
            description=expense.description,
            status='Approved',
            total_amount_local=total_amount_local,
            local_currency_code=expense.local_currency_code,
            exchange_rate=exchange_rate,
            total_amount_company_currency=total_amount_company_currency,
            current_approval_step=0,
            current_flow_rule_id=None
        )
    else:
        db_expense = models.Expense(
            employee_id=employee_id,
            company_id=company_id,
            submission_date=datetime.datetime.utcnow(),
            description=expense.description,
            status='Submitted',
            total_amount_local=total_amount_local,
            local_currency_code=expense.local_currency_code,
            exchange_rate=exchange_rate,
            total_amount_company_currency=total_amount_company_currency,
            current_approval_step=1,
            current_flow_rule_id=employee.approval_rule_id if employee else None
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
            expense=db_expense
        )
        db.add(db_line)

    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    
    # If expense has approval rule and not Admin, set status to Pending
    if employee and employee.role != 'Admin' and employee.approval_rule_id:
        db_expense.status = 'Pending'
        db.commit()
        db.refresh(db_expense)
    
    print(f"Expense created: ID={db_expense.expense_id}, Status={db_expense.status}, Rule ID={db_expense.current_flow_rule_id}")
    print(f"  Local: {db_expense.total_amount_local} {db_expense.local_currency_code}")
    print(f"  Company: {db_expense.total_amount_company_currency:.2f} {company.default_currency_code} (rate: {db_expense.exchange_rate})")
    
    return db_expense

def get_user_expenses(db: Session, user_id: int) -> List[models.Expense]:
    """Retrieves all expenses submitted by a specific user."""
    return db.query(models.Expense).filter(models.Expense.employee_id == user_id).all()
def create_approval_rule(
    db: Session, 
    rule_data: schemas.ApprovalRuleCreate, 
    company_id: int
) -> models.ApprovalRule:
    """Creates a new approval rule with required and normal approvers."""
    
    # Create the approval rule first
    db_rule = models.ApprovalRule(
        company_id=company_id,
        name=rule_data.name,
        description=rule_data.description,
        is_active=rule_data.is_active,
        threshold_amount=rule_data.threshold_amount,
        approval_percentage=rule_data.approval_percentage
    )
    
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    
    print(f"Created approval rule: ID={db_rule.rule_id}, Name={db_rule.name}")
    
    # Now add required approvers with the committed rule_id
    for approver_data in rule_data.required_approvers:
        db_required = models.RuleRequiredApprover(
            rule_id=db_rule.rule_id,
            user_id=approver_data.user_id,
            sequence=0
        )
        db.add(db_required)
        print(f"  Added required approver: user_id={approver_data.user_id}")
    
    # Add normal approvers (in sequence) with the committed rule_id
    for approver_data in rule_data.normal_approvers:
        db_normal = models.RuleNormalApprover(
            rule_id=db_rule.rule_id,
            user_id=approver_data.user_id,
            sequence=approver_data.sequence
        )
        db.add(db_normal)
        print(f"  Added normal approver: user_id={approver_data.user_id}, sequence={approver_data.sequence}")
    
    db.commit()
    db.refresh(db_rule)
    
    # Verify approvers were added
    required_count = db.query(models.RuleRequiredApprover).filter(
        models.RuleRequiredApprover.rule_id == db_rule.rule_id
    ).count()
    
    normal_count = db.query(models.RuleNormalApprover).filter(
        models.RuleNormalApprover.rule_id == db_rule.rule_id
    ).count()
    
    print(f"Rule {db_rule.rule_id} created with {required_count} required and {normal_count} normal approvers")
    
    return db_rule

def get_pending_approvals_for_user(db: Session, user_id: int) -> List[models.Expense]:
    """Get all expenses pending approval by this user."""
    
    pending_expenses = []
    
    # Get all pending expenses
    expenses = db.query(models.Expense).filter(
        models.Expense.status == 'Pending'
    ).all()
    
    print(f"\n{'='*60}")
    print(f"Checking pending approvals for user {user_id}")
    print(f"Total pending expenses: {len(expenses)}")
    print(f"{'='*60}")
    
    for expense in expenses:
        # Check if user has already approved
        existing_approval = db.query(models.ExpenseApproval).filter(
            models.ExpenseApproval.expense_id == expense.expense_id,
            models.ExpenseApproval.approver_id == user_id,
            models.ExpenseApproval.status == 'Approved'
        ).first()
        
        if existing_approval:
            print(f"Expense {expense.expense_id}: User already approved")
            continue
        
        # Get the employee who submitted the expense
        employee = db.query(models.User).filter(
            models.User.user_id == expense.employee_id
        ).first()
        
        if not employee:
            print(f"Expense {expense.expense_id}: Employee not found")
            continue
            
        if not employee.approval_rule_id:
            print(f"Expense {expense.expense_id}: No approval rule assigned to employee {employee.name}")
            continue
        
        rule = db.query(models.ApprovalRule).filter(
            models.ApprovalRule.rule_id == employee.approval_rule_id
        ).first()
        
        if not rule:
            print(f"Expense {expense.expense_id}: Approval rule not found")
            continue
        
        print(f"\nExpense {expense.expense_id} submitted by {employee.name}:")
        print(f"  Rule: {rule.name} (Percentage: {rule.approval_percentage}%)")
        
        # Check if user is a required approver
        is_required = db.query(models.RuleRequiredApprover).filter(
            models.RuleRequiredApprover.rule_id == rule.rule_id,
            models.RuleRequiredApprover.user_id == user_id
        ).first()
        
        if is_required:
            print(f"  User {user_id} is a REQUIRED approver")
            # Check if ALL required approvers have approved
            all_required = db.query(models.RuleRequiredApprover).filter(
                models.RuleRequiredApprover.rule_id == rule.rule_id
            ).all()
            
            required_approved_count = 0
            for req_approver in all_required:
                approval = db.query(models.ExpenseApproval).filter(
                    models.ExpenseApproval.expense_id == expense.expense_id,
                    models.ExpenseApproval.approver_id == req_approver.user_id,
                    models.ExpenseApproval.status == 'Approved'
                ).first()
                if approval:
                    required_approved_count += 1
            
            print(f"  Required approvals: {required_approved_count}/{len(all_required)}")
            
            # If this user hasn't approved yet, show it as pending
            if required_approved_count < len(all_required):
                print(f"  ✅ Adding to pending list for user {user_id}")
                pending_expenses.append(expense)
                continue
        
        # Check if user is a normal approver
        is_normal = db.query(models.RuleNormalApprover).filter(
            models.RuleNormalApprover.rule_id == rule.rule_id,
            models.RuleNormalApprover.user_id == user_id
        ).first()
        
        if is_normal:
            print(f"  User {user_id} is a NORMAL approver (sequence {is_normal.sequence})")
            
            # First check: All required approvers must be done
            all_required = db.query(models.RuleRequiredApprover).filter(
                models.RuleRequiredApprover.rule_id == rule.rule_id
            ).all()
            
            if all_required:
                required_approved_count = db.query(models.ExpenseApproval).filter(
                    models.ExpenseApproval.expense_id == expense.expense_id,
                    models.ExpenseApproval.approver_id.in_([r.user_id for r in all_required]),
                    models.ExpenseApproval.status == 'Approved'
                ).count()
                
                print(f"  Required approvals complete: {required_approved_count}/{len(all_required)}")
                
                if required_approved_count < len(all_required):
                    print(f"  ❌ Required approvers not done yet")
                    continue
            
            # CRITICAL: Check if enough approvals have been received to satisfy percentage
            all_normal = db.query(models.RuleNormalApprover).filter(
                models.RuleNormalApprover.rule_id == rule.rule_id
            ).order_by(models.RuleNormalApprover.sequence).all()
            
            approval_percentage = rule.approval_percentage if rule.approval_percentage else 100.0
            import math
            normal_approvers_needed = math.ceil(len(all_normal) * (approval_percentage / 100.0))
            
            # Count current normal approvals
            normal_approvals_count = db.query(models.ExpenseApproval).filter(
                models.ExpenseApproval.expense_id == expense.expense_id,
                models.ExpenseApproval.approver_id.in_([n.user_id for n in all_normal]),
                models.ExpenseApproval.status == 'Approved'
            ).count()
            
            print(f"  Normal approvals: {normal_approvals_count}/{normal_approvers_needed} needed (from {len(all_normal)} total)")
            
            # If we already have enough approvals, don't show to anyone else
            if normal_approvals_count >= normal_approvers_needed:
                print(f"  ❌ Already have enough normal approvals ({normal_approvals_count}/{normal_approvers_needed})")
                continue
            
            # Check sequential order: all previous approvers must have approved
            previous_approvers = db.query(models.RuleNormalApprover).filter(
                models.RuleNormalApprover.rule_id == rule.rule_id,
                models.RuleNormalApprover.sequence < is_normal.sequence
            ).all()
            
            if previous_approvers:
                previous_approved_count = db.query(models.ExpenseApproval).filter(
                    models.ExpenseApproval.expense_id == expense.expense_id,
                    models.ExpenseApproval.approver_id.in_([p.user_id for p in previous_approvers]),
                    models.ExpenseApproval.status == 'Approved'
                ).count()
                
                print(f"  Previous sequential approvals: {previous_approved_count}/{len(previous_approvers)}")
                
                if previous_approved_count == len(previous_approvers):
                    print(f"  ✅ All previous approvers done, adding to pending list for user {user_id}")
                    pending_expenses.append(expense)
                else:
                    print(f"  ❌ Not this user's turn yet (need {len(previous_approvers) - previous_approved_count} more before)")
            else:
                # This is the first normal approver
                print(f"  ✅ First normal approver - adding to pending list")
                pending_expenses.append(expense)
    
    print(f"\nTotal pending for user {user_id}: {len(pending_expenses)}")
    print(f"{'='*60}\n")
    
    return pending_expenses

def create_expense_approval(
    db: Session,
    expense_id: int,
    approver_id: int,
    status: str,
    comments: Optional[str] = None
) -> models.ExpenseApproval:
    """Create an approval record."""
    db_approval = models.ExpenseApproval(
        expense_id=expense_id,
        approver_id=approver_id,
        status=status,
        comments=comments,
        approval_date=datetime.datetime.utcnow()
    )
    db.add(db_approval)
    
    # IMPORTANT: Commit the approval first
    db.commit()
    db.refresh(db_approval)
    
    # Update expense status
    expense = db.query(models.Expense).filter(
        models.Expense.expense_id == expense_id
    ).first()
    
    if status == 'Rejected':
        expense.status = 'Rejected'
        db.commit()
        db.refresh(expense)
        return db_approval
    
    if status == 'Approved':
        # Get employee and rule
        employee = db.query(models.User).filter(
            models.User.user_id == expense.employee_id
        ).first()
        
        if not employee or not employee.approval_rule_id:
            # No approval rule, mark as approved
            expense.status = 'Approved'
            db.commit()
            db.refresh(expense)
            return db_approval
        
        rule = db.query(models.ApprovalRule).filter(
            models.ApprovalRule.rule_id == employee.approval_rule_id
        ).first()
        
        if not rule:
            expense.status = 'Approved'
            db.commit()
            db.refresh(expense)
            return db_approval
        
        # Count all required approvers
        all_required = db.query(models.RuleRequiredApprover).filter(
            models.RuleRequiredApprover.rule_id == rule.rule_id
        ).all()
        
        # Count all normal approvers (ordered by sequence)
        all_normal = db.query(models.RuleNormalApprover).filter(
            models.RuleNormalApprover.rule_id == rule.rule_id
        ).order_by(models.RuleNormalApprover.sequence).all()
        
        # Count current approvals
        current_approvals = db.query(models.ExpenseApproval).filter(
            models.ExpenseApproval.expense_id == expense_id,
            models.ExpenseApproval.status == 'Approved'
        ).all()
        
        # Count required approvals
        required_approvals = [a for a in current_approvals if any(r.user_id == a.approver_id for r in all_required)]
        
        # Count normal approvals
        normal_approvals = [a for a in current_approvals if any(n.user_id == a.approver_id for n in all_normal)]
        
        # Calculate percentage needed
        approval_percentage = rule.approval_percentage if rule.approval_percentage else 100.0
        normal_approvers_needed = len(all_normal)
        
        if approval_percentage < 100.0 and len(all_normal) > 0:
            # Calculate how many normal approvers are needed based on percentage
            import math
            normal_approvers_needed = math.ceil(len(all_normal) * (approval_percentage / 100.0))
        
        print(f"\n{'='*60}")
        print(f"APPROVAL STATUS CHECK FOR EXPENSE {expense_id}")
        print(f"{'='*60}")
        print(f"Approval Rule: {rule.name}")
        print(f"Approval Percentage: {approval_percentage}%")
        print(f"Required approvers:")
        print(f"  - Total: {len(all_required)}")
        print(f"  - Approved: {len(required_approvals)}")
        print(f"Normal approvers:")
        print(f"  - Total: {len(all_normal)}")
        print(f"  - Approved: {len(normal_approvals)}")
        print(f"  - Needed (based on {approval_percentage}%): {normal_approvers_needed}")
        
        # IMPORTANT: Verify sequential approval (even with percentage)
        if len(normal_approvals) > 0 and approval_percentage < 100.0:
            # Get the highest sequence number that has approved
            approved_sequences = []
            for approval in normal_approvals:
                for normal in all_normal:
                    if normal.user_id == approval.approver_id:
                        approved_sequences.append(normal.sequence)
                        break
            
            if approved_sequences:
                max_approved_sequence = max(approved_sequences)
                print(f"  - Highest approved sequence: {max_approved_sequence}")
                
                # Verify all sequences before max are approved
                for seq in range(1, max_approved_sequence + 1):
                    if seq not in approved_sequences:
                        print(f"  ⚠️ WARNING: Sequence {seq} skipped! Sequential order violated!")
        
        # Check if all conditions are met
        all_required_approved = len(required_approvals) == len(all_required)
        enough_normal_approved = len(normal_approvals) >= normal_approvers_needed
        
        print(f"All required approved: {all_required_approved}")
        print(f"Enough normal approved: {enough_normal_approved}")
        
        if all_required_approved and enough_normal_approved:
            expense.status = 'Approved'
            print(f"✅ All conditions met! Setting status to Approved")
        else:
            expense.status = 'Pending'
            if not all_required_approved:
                print(f"⏳ Still need {len(all_required) - len(required_approvals)} required approval(s)")
            if not enough_normal_approved:
                print(f"⏳ Still need {normal_approvers_needed - len(normal_approvals)} more normal approval(s) (in sequence)")
        print(f"{'='*60}\n")
    
    db.commit()
    db.refresh(expense)
    return db_approval

def get_all_company_manager_candidates(db: Session, company_id: int) -> List[models.User]:
    """Retrieves all users in the company who can be assigned as a manager/required approver."""
    return db.query(models.User).filter(
        models.User.company_id == company_id
    ).all()

def get_all_company_users(db: Session, company_id: int) -> List[models.User]:
    """Retrieves all users within a company."""
    # This function is retained or updated to simply return all users for general list views
    return db.query(models.User).filter(
        models.User.company_id == company_id
    ).all()