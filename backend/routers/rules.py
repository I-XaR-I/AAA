from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy.orm import joinedload

from ..db.database import get_db
from ..db import crud
from ..models import schemas
from ..core.auth_utils import get_current_user

router = APIRouter(
    prefix="/rules",
    tags=["Approval Rules"]
)

@router.post("/", response_model=schemas.ApprovalRule, status_code=status.HTTP_201_CREATED)
def create_approval_rule(
    rule_data: schemas.ApprovalRuleCreate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to create a new approval rule."""
    admin_user = db.query(crud.models.User).filter(crud.models.User.user_id == user_id).first()
    
    if not admin_user or admin_user.role != 'Admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin users can create approval rules."
        )
    
    print(f"Creating approval rule: {rule_data.name}")
    new_rule = crud.create_approval_rule(db, rule_data, admin_user.company_id)
    
    # Refresh to load relationships
    db.refresh(new_rule)
    
    # Manually load the relationships
    db.query(crud.models.ApprovalRule).filter(
        crud.models.ApprovalRule.rule_id == new_rule.rule_id
    ).options(
        joinedload(crud.models.ApprovalRule.required_approvers),
        joinedload(crud.models.ApprovalRule.normal_approvers)
    ).first()
    
    print(f"Rule created: ID {new_rule.rule_id}")
    print(f"  Required approvers: {len(new_rule.required_approvers)}")
    print(f"  Normal approvers: {len(new_rule.normal_approvers)}")
    
    return new_rule

@router.get("/", response_model=List[schemas.ApprovalRule])
def get_approval_rules(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all approval rules for the company."""
    user = db.query(crud.models.User).filter(crud.models.User.user_id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Fetch rules with their approvers eagerly loaded
    rules = db.query(crud.models.ApprovalRule).filter(
        crud.models.ApprovalRule.company_id == user.company_id
    ).options(
        joinedload(crud.models.ApprovalRule.required_approvers),
        joinedload(crud.models.ApprovalRule.normal_approvers)
    ).all()
    
    # Log what we're returning
    for rule in rules:
        print(f"Returning Rule {rule.rule_id}: {len(rule.required_approvers)} required, {len(rule.normal_approvers)} normal")
        for req in rule.required_approvers:
            print(f"  Required: user_id={req.user_id}, sequence={req.sequence}")
        for norm in rule.normal_approvers:
            print(f"  Normal: user_id={norm.user_id}, sequence={norm.sequence}")
    
    return rules
