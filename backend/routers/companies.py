from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import crud
from ..models import schemas
from ..core.auth_utils import get_current_user

router = APIRouter(
    prefix="/companies",
    tags=["Companies"]
)

@router.get("/{company_id}", response_model=schemas.CompanyBase)
def get_company(
    company_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get company details."""
    # Verify user belongs to this company
    user = db.query(crud.models.User).filter(
        crud.models.User.user_id == user_id
    ).first()
    
    if not user or user.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    company = db.query(crud.models.Company).filter(
        crud.models.Company.company_id == company_id
    ).first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    return company
