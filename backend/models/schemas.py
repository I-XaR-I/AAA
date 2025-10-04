from pydantic import BaseModel, EmailStr
from typing import List, Optional
import datetime

# --- Base Schemas for Core Tables (Read) ---

class CompanyBase(BaseModel):
    name: str
    default_currency_code: str

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str
    manager_id: Optional[int] = None
    is_manager_approver: bool = False

class ExpenseCategoryBase(BaseModel):
    name: str

class ExpenseLineBase(BaseModel):
    category_id: Optional[int] = None
    vendor_name: Optional[str] = None
    date: Optional[str] = None # YYYY-MM-DD
    amount_local: float
    description: Optional[str] = None
    receipt_url: Optional[str] = None
    expense_type: Optional[str] = None

class ApprovalFlowStepBase(BaseModel):
    step_sequence: int
    approver_type: str # 'Required', 'Normal'
    target_value: Optional[str] = None

class ApprovalRuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True
    threshold_amount: float = 0.0
    approval_percentage: float = 100.0  # Percentage of normal approvers needed

# --- Create Schemas (Write) ---

class UserCreate(UserBase):
    pass # No change needed for creation yet

class ExpenseLineCreate(ExpenseLineBase):
    pass

class ExpenseCreate(BaseModel):
    description: Optional[str] = None
    local_currency_code: str
    expense_lines: List[ExpenseLineCreate]

class RequiredApproverCreate(BaseModel):
    user_id: int

class NormalApproverCreate(BaseModel):
    user_id: int
    sequence: int

class ApprovalRuleCreate(ApprovalRuleBase):
    required_approvers: List[RequiredApproverCreate] = []
    normal_approvers: List[NormalApproverCreate] = []

# --- Full Schemas (Response) ---

class ExpenseLine(ExpenseLineBase):
    line_id: int
    expense_id: int
    
    class Config:
        from_attributes = True

class ExpenseApproval(BaseModel):
    approval_id: int
    approver_id: int
    status: str
    comments: Optional[str] = None
    approval_date: datetime.datetime
    
    class Config:
        from_attributes = True

class Expense(BaseModel):
    expense_id: int
    employee_id: int
    company_id: int
    submission_date: datetime.datetime
    description: Optional[str] = None
    status: str
    total_amount_local: float
    local_currency_code: str
    exchange_rate: Optional[float] = None  # Ensure this is included
    total_amount_company_currency: Optional[float] = None
    current_approval_step: int
    
    expense_lines: List[ExpenseLine] = []
    expense_approvals: List[ExpenseApproval] = []

    class Config:
        from_attributes = True

class User(UserBase):
    user_id: int
    company_id: int
    
    class Config:
        from_attributes = True

# --- Update User Schema ---
# Needed for Admin to update an Employee/Manager's details and approval rule ID

class UserUpdate(BaseModel):
    """Schema for updating user details."""
    name: Optional[str] = None
    role: Optional[str] = None
    manager_id: Optional[int] = None
    is_manager_approver: Optional[bool] = None
    approval_rule_id: Optional[int] = None
    
    class Config:
        from_attributes = True

class ApprovalFlowStep(ApprovalFlowStepBase):
    step_id: int
    rule_id: int
    
    class Config:
        from_attributes = True

class RequiredApprover(BaseModel):
    id: int
    user_id: int
    sequence: int
    
    class Config:
        from_attributes = True

class NormalApprover(BaseModel):
    id: int
    user_id: int
    sequence: int
    
    class Config:
        from_attributes = True

class ApprovalRule(ApprovalRuleBase):
    rule_id: int
    company_id: int
    required_approvers: List[RequiredApprover] = []
    normal_approvers: List[NormalApprover] = []
    
    class Config:
        from_attributes = True