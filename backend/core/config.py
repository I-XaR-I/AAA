from pydantic_settings import BaseSettings
from typing import List, Union

# Note: In FastAPI 0.100.0+, you would typically import Settings from pydantic-settings
# For compatibility with older environments, we use the class name that works.

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables (.env file) 
    or defaults.
    """
    # --- Application Settings ---
    PROJECT_NAME: str = "Expense Management API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # --- Database Settings ---
    # Database path for SQLite is relative to the project root/execution context
    # It's highly recommended to use a full path or configuration to avoid errors.
    # The database file is placed in 'backend/' as per the structure.
    SQLITE_DB_PATH: str = "backend/expense_management.db"
    DATABASE_URL: str = f"sqlite:///{SQLITE_DB_PATH}"

    # --- Security Settings (Referenced from security.py) ---
    SECRET_KEY: str = "YOUR_SUPER_SECURE_SECRET_KEY_FOR_PROD" # MUST BE CHANGED
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # --- CORS Settings ---
    # List of origins allowed to make requests to the API
    BACKEND_CORS_ORIGINS: List[Union[str, None]] = [
        "http://localhost",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*" # Broadly allowing all origins for initial development/canvas preview
    ]

    # --- External API Keys ---
    # API key for currency conversion (Example placeholder)
    EXCHANGE_RATE_API_URL: str = "https://api.exchangerate-api.com/v4/latest/{BASE_CURRENCY}"
    # API key for OCR service (Example placeholder)
    OCR_API_KEY: str = "MOCK_OCR_API_KEY"

    class Config:
        case_sensitive = True
        # FastAPI/Pydantic will automatically look for environment variables
        # prefixed by the class name or settings name.
        
# Create a single instance of settings to be imported across the application
settings = Settings()
