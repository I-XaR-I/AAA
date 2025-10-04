from fastapi import Depends, HTTPException, status
# 1. CHANGE: Import OAuth2PasswordBearer instead of OAuth2
from fastapi.security import OAuth2PasswordBearer 
from sqlalchemy.orm import Session
from typing import Optional

from ..db.database import get_db
from ..db import crud
from ..models import schemas

# --- Placeholder Authentication Logic ---
# In a real application, you'd use JWTs. Here we extract the user ID from the mock token.
# 2. CHANGE: Instantiate OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_user_id_from_token(token: str) -> Optional[int]:
    """Mocks token decoding to retrieve the user_id embedded in the mock token string."""
    try:
        if token.startswith("MOCK_TOKEN_"):
            return int(token.split("_")[-1])
        elif token.startswith("MOCK_ADMIN_TOKEN_"):
            return int(token.split("_")[-1])
    except:
        pass
    return None

# --- Dependency Function for Secured Endpoints ---

# The token parameter is now automatically handled by OAuth2PasswordBearer
def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> int:
    """Dependency to get the currently authenticated user's ID."""
    user_id = get_user_id_from_token(token)
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Returning the ID only:
    return user_id