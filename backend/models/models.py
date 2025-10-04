import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

# Define the base class for declarative class definitions
Base = declarative_base()

class Company(Base):
    """Corresponds to the Companies table."""
    __tablename__ = 'companies'

    company_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    default_currency_code = Column(String, nullable=False) # e.g., 'USD', 'EUR'

    # Relationships
    users = relationship("User", back_populates="company")
    categories = relationship("ExpenseCategory", back_populates="company")
    rules = relationship("ApprovalRule", back_populates="company")

class User(Base):
    """Corresponds to the Users table."""
    __tablename__ = 'users'

    user_id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey('companies.company_id'), nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False) # 'Admin', 'Manager', 'Employee'
    
    # Manager relationship (self-referential)
    manager_id = Column(Integer, ForeignKey('users.user_id'))
    is_manager_approver = Column(Boolean, default=False) # 1 or 0 in SQLite, mapped to Boolean

    # Relationships
    company = relationship("Company", back_populates="users")
    manager = relationship("User", remote_side=[user_id], back_populates="subordinates")
    subordinates = relationship("User", back_populates="manager")
    expenses = relationship("Expense", back_populates="employee")
    approvals = relationship("ExpenseApproval", back_populates="approver")


class ExpenseCategory(Base):
    """Corresponds to the ExpenseCategories table."""
    __tablename__ = 'expense_categories'

    category_id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey('companies.company_id'), nullable=False)
    name = Column(String, nullable=False)

    # Relationships
    company = relationship("Company", back_populates="categories")
    expense_lines = relationship("ExpenseLine", back_populates="category")


class Expense(Base):
    """Corresponds to the Expenses table (Header/Claim)."""
    __tablename__ = 'expenses'

    expense_id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey('users.user_id'), nullable=False)
    company_id = Column(Integer, ForeignKey('companies.company_id'), nullable=False)
    submission_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    description = Column(String)
    status = Column(String, nullable=False, default='Draft') # 'Draft', 'Submitted', 'Pending', 'Approved', 'Rejected'

    # Multi-currency fields
    total_amount_local = Column(Float, nullable=False)
    local_currency_code = Column(String, nullable=False)
    exchange_rate = Column(Float)
    total_amount_company_currency = Column(Float)

    # Workflow tracking
    current_approval_step = Column(Integer, default=1, nullable=False)
    current_flow_rule_id = Column(Integer, ForeignKey('approval_rules.rule_id'))

    # Relationships
    employee = relationship("User", back_populates="expenses")
    rule = relationship("ApprovalRule")
    expense_lines = relationship("ExpenseLine", back_populates="expense", cascade="all, delete-orphan")
    expense_approvals = relationship("ExpenseApproval", back_populates="expense", cascade="all, delete-orphan")


class ExpenseLine(Base):
    """Corresponds to the ExpenseLines table (Detailed items)."""
    __tablename__ = 'expense_lines'

    line_id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey('expenses.expense_id'), nullable=False)
    category_id = Column(Integer, ForeignKey('expense_categories.category_id'))
    vendor_name = Column(String) # Storing vendor/restaurant name directly
    date = Column(String) # Could be Date type, but String for simple SQLite compatibility
    amount_local = Column(Float, nullable=False)
    description = Column(String)
    receipt_url = Column(String)
    expense_type = Column(String)

    # Relationships
    expense = relationship("Expense", back_populates="expense_lines")
    category = relationship("ExpenseCategory", back_populates="expense_lines")


class ApprovalRule(Base):
    """Corresponds to the ApprovalRules table."""
    __tablename__ = 'approval_rules'

    rule_id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey('companies.company_id'), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String)
    is_active = Column(Boolean, default=True, nullable=False)
    threshold_amount = Column(Float, default=0.0)

    # Relationships
    company = relationship("Company", back_populates="rules")
    flow_steps = relationship("ApprovalFlowStep", back_populates="rule", cascade="all, delete-orphan")


class ApprovalFlowStep(Base):
    """Corresponds to the ApprovalFlowSteps table."""
    __tablename__ = 'approval_flow_steps'

    step_id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey('approval_rules.rule_id'), nullable=False)
    step_sequence = Column(Integer, nullable=False)
    approver_type = Column(String, nullable=False) # 'Manager', 'Role', 'SpecificUser', 'Conditional'
    target_value = Column(String) # User ID, Role name (Finance), or rule definition

    # Relationships
    rule = relationship("ApprovalRule", back_populates="flow_steps")
    expense_approvals = relationship("ExpenseApproval", back_populates="flow_step")


class ExpenseApproval(Base):
    """Corresponds to the ExpenseApprovals table (Log of actions)."""
    __tablename__ = 'expense_approvals'

    approval_id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey('expenses.expense_id'), nullable=False)
    approver_id = Column(Integer, ForeignKey('users.user_id'), nullable=False)
    flow_step_id = Column(Integer, ForeignKey('approval_flow_steps.step_id'))
    status = Column(String, nullable=False) # 'Approved', 'Rejected', 'Escalated'
    comments = Column(String)
    approval_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    expense = relationship("Expense", back_populates="expense_approvals")
    approver = relationship("User", back_populates="approvals")
    flow_step = relationship("ApprovalFlowStep", back_populates="expense_approvals")
