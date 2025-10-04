from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db.database import init_db

# Assuming you'll have routers defined
# from .routers import auth, expenses, approvals

app = FastAPI(
    title="Expense Management API",
    description="A FastAPI backend for handling expense submissions and approvals.",
    version="1.0.0"
)

# CORS Middleware Setup (Essential for Frontend/Backend communication)
origins = [
    "http://localhost",
    "http://localhost:8000", # Example frontend port
    "http://127.0.0.1:8000",
    # Add your frontend URL/domain here when deployed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    """Initializes the database when the application starts."""
    init_db()

@app.get("/")
def read_root():
    return {"message": "Expense Management API is running"}

# Include routers here when ready (e.g., app.include_router(auth.router))
