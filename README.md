# ExpenseFlow – Modern Expense Management System

## Project Information

### Team Details
- **Team Name:** HackHorizons
- **Team Members:**
  - Avighn Kumar Lakhpuria
  - Ankit Kumar
  - Aakash Kumar Dubey

### Project Metadata
- **Problem Statement:** Expense Management System
- **Reviewer Name:** Aman Patel
- **Video Presentation Link:** https://drive.google.com/file/d/1cR35aay_L4dndOvPUcizGgGa-WycETQ6/view?usp=sharing

---

## Overview

ExpenseFlow is a full‑stack web application that digitises the way small and medium sized organisations handle employee expenses. Manual reimbursement processes are often time‑consuming, error‑prone and lack transparency. ExpenseFlow solves these issues by providing a self‑service portal for employees, managers and administrators to submit, track and approve expense claims with configurable approval workflows, multi‑currency support and extensible rules.

This repository contains both the backend (built with FastAPI, SQLAlchemy and SQLite) and the frontend (static HTML/CSS/JavaScript) for the ExpenseFlow project. The core features were guided by the problem statement included in the `Problem Statement _ Expense Management.pdf` file in this archive.

## Key Features

| Category | Description |
|----------|-------------|
| **Authentication & Users** | On the very first sign‑up, a new company and an admin user are automatically created. Administrators can log in and create employee and manager accounts, assign reporting relationships and configure who acts as a "manager approver". Passwords are hashed using bcrypt via Passlib. |
| **Expense Submission** | Employees and managers can submit expense claims that may consist of multiple line items (category, amount, vendor, date, description and optional receipt URL). Claims can be entered in any currency; conversion to the company's default currency happens automatically using live exchange rates. |
| **Approval Workflow** | Expenses follow a configurable approval flow. A manager can be set as the first approver, followed by other approvers or conditional rules. Each approval (or rejection) is logged, and the claim advances to the next step only after the current approver acts. |
| **Conditional Rules** | The system supports several rule types: percentage‑based (e.g. "60% of approvers must approve"), specific approver (e.g. "CFO must approve"), or hybrid combinations. Required approvers must all approve; normal approvers can be sequenced and optionally aggregated by a percentage threshold. |
| **Role‑Based Permissions** | • **Admin** – create and manage companies, employees and managers; configure approval rules; view and override any expense.<br>• **Manager** – approve/reject expenses for their direct reports and view their team's expenses.<br>• **Employee** – submit expenses, view their own history and track approval status. |
| **Multi‑Currency** | Every company has a default currency. When submitting expenses in a different currency, the backend fetches the exchange rate from `api.exchangerate-api.com` (this is configurable) and stores both the local amount and the converted amount. |
| **OCR Placeholder** | The problem statement calls for receipt scanning and OCR‑based auto‑population of expense fields. This repository lays the groundwork by storing a receipt URL per expense line; actual OCR integration would require an API key and additional backend code. |
| **Responsive Front‑End** | The frontend folder contains a vanilla JavaScript single‑page application. Users can sign up or log in, view dashboards tailored to their role, submit expenses, manage approval rules and track pending approvals. The UI uses the Inter font and simple CSS for a clean, modern look. |

> **Note:** This project is intended as a learning exercise and proof of concept. The authentication flow uses mock tokens rather than real JWTs, and the database is a local SQLite file. Do not deploy this to production without adding proper security, environment configuration and persistent storage.

## Project Structure

```
Amalthea/
└── AAA
    ├── backend/                    # FastAPI application
    │   ├── core/                   # Security, configuration and auth helpers
    │   ├── db/                     # SQLAlchemy session management and CRUD utilities
    │   ├── models/                 # ORM models and Pydantic schemas
    │   │   ├── models.py          # SQLAlchemy ORM models
    │   │   └── schemas.py         # Pydantic validation schemas
    │   ├── routers/                # API route handlers (auth, expenses, rules, companies)
    │   ├── expense_management.db   # SQLite database (created on startup)
    │   ├── main.py                 # FastAPI entry point
    │   └── requirements.txt        # Python dependencies
    ├── frontend/                   # Static frontend files
    │   ├── index.html              # Sign‑up and login page
    │   ├── dashboard.html          # Authenticated user dashboard
    │   ├── css/                    # Stylesheets
    │   └── js/                     # Front‑end logic (auth, dashboard, admin, expenses, approvals)
    ├── Problem Statement _ Expense Management.pdf  # Original brief
    └── Expense management - 8 hours.png            # Project illustration
```

## Data Architecture

### Database Models (SQLAlchemy ORM)

The application uses SQLAlchemy ORM to define the following database models:

#### 1. Company Model
Represents organizations using the system.

**Table:** `companies`

| Column | Type | Description |
|--------|------|-------------|
| `company_id` | Integer (PK) | Unique company identifier |
| `name` | String | Company name |
| `default_currency_code` | String | Default currency (e.g., USD, EUR) |

**Relationships:**
- One-to-Many with `User`
- One-to-Many with `ExpenseCategory`
- One-to-Many with `ApprovalRule`

#### 2. User Model
Represents all users in the system (Admin, Manager, Employee).

**Table:** `users`

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | Integer (PK) | Unique user identifier |
| `company_id` | Integer (FK) | Reference to company |
| `email` | String | User email (unique) |
| `name` | String | User full name |
| `role` | String | Role: Admin, Manager, or Employee |
| `hashed_password` | String | Bcrypt hashed password |
| `manager_id` | Integer (FK) | Self-referential FK to manager |
| `is_manager_approver` | Boolean | Whether manager is in approval chain |
| `approval_rule_id` | Integer (FK) | Associated approval rule |

**Relationships:**
- Many-to-One with `Company`
- Self-referential: One manager has many subordinates
- One-to-Many with `Expense`
- One-to-Many with `ExpenseApproval`

#### 3. ExpenseCategory Model
Expense categories defined per company.

**Table:** `expense_categories`

| Column | Type | Description |
|--------|------|-------------|
| `category_id` | Integer (PK) | Unique category identifier |
| `company_id` | Integer (FK) | Reference to company |
| `name` | String | Category name (e.g., Travel, Meals) |

**Relationships:**
- Many-to-One with `Company`
- One-to-Many with `ExpenseLine`

#### 4. Expense Model
Represents expense claims (header/claim level).

**Table:** `expenses`

| Column | Type | Description |
|--------|------|-------------|
| `expense_id` | Integer (PK) | Unique expense identifier |
| `employee_id` | Integer (FK) | Reference to submitting employee |
| `company_id` | Integer (FK) | Reference to company |
| `submission_date` | DateTime | When expense was submitted |
| `description` | String | Overall expense description |
| `status` | String | Draft, Submitted, Pending, Approved, Rejected |
| `total_amount_local` | Float | Total in local currency |
| `local_currency_code` | String | Currency code (e.g., GBP) |
| `exchange_rate` | Float | Conversion rate to company currency |
| `total_amount_company_currency` | Float | Converted total amount |
| `current_approval_step` | Integer | Current step in approval workflow |
| `current_flow_rule_id` | Integer (FK) | Active approval rule |

**Relationships:**
- Many-to-One with `User` (employee)
- Many-to-One with `ApprovalRule`
- One-to-Many with `ExpenseLine`
- One-to-Many with `ExpenseApproval`

#### 5. ExpenseLine Model
Individual line items within an expense claim.

**Table:** `expense_lines`

| Column | Type | Description |
|--------|------|-------------|
| `line_id` | Integer (PK) | Unique line item identifier |
| `expense_id` | Integer (FK) | Reference to parent expense |
| `category_id` | Integer (FK) | Reference to expense category |
| `vendor_name` | String | Vendor/merchant name |
| `date` | String | Date of expense (YYYY-MM-DD) |
| `amount_local` | Float | Line item amount |
| `description` | String | Line item description |
| `receipt_url` | String | URL to receipt image |
| `expense_type` | String | Type of expense |

**Relationships:**
- Many-to-One with `Expense`
- Many-to-One with `ExpenseCategory`

#### 6. ApprovalRule Model
Configurable approval rules for expense workflows.

**Table:** `approval_rules`

| Column | Type | Description |
|--------|------|-------------|
| `rule_id` | Integer (PK) | Unique rule identifier |
| `company_id` | Integer (FK) | Reference to company |
| `name` | String | Rule name |
| `description` | String | Rule description |
| `is_active` | Boolean | Whether rule is active |
| `threshold_amount` | Float | Amount threshold for rule activation |
| `approval_percentage` | Float | Percentage of approvers needed (0-100) |

**Relationships:**
- Many-to-One with `Company`
- One-to-Many with `RuleRequiredApprover`
- One-to-Many with `RuleNormalApprover`

#### 7. RuleRequiredApprover Model
Required approvers who must approve before normal approvers.

**Table:** `rule_required_approvers`

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Unique identifier |
| `rule_id` | Integer (FK) | Reference to approval rule |
| `user_id` | Integer (FK) | Reference to approver user |
| `sequence` | Integer | Approval sequence (all get notified together) |

**Relationships:**
- Many-to-One with `ApprovalRule`
- Many-to-One with `User`

#### 8. RuleNormalApprover Model
Normal approvers who approve in sequence after required approvers.

**Table:** `rule_normal_approvers`

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Unique identifier |
| `rule_id` | Integer (FK) | Reference to approval rule |
| `user_id` | Integer (FK) | Reference to approver user |
| `sequence` | Integer | Order in which they approve |

**Relationships:**
- Many-to-One with `ApprovalRule`
- Many-to-One with `User`

#### 9. ApprovalFlowStep Model
Defines steps in approval workflows.

**Table:** `approval_flow_steps`

| Column | Type | Description |
|--------|------|-------------|
| `step_id` | Integer (PK) | Unique step identifier |
| `rule_id` | Integer (FK) | Reference to approval rule |
| `step_sequence` | Integer | Order of this step |
| `approver_type` | String | Required or Normal |
| `target_value` | String | User ID of approver |

**Relationships:**
- One-to-Many with `ExpenseApproval`

#### 10. ExpenseApproval Model
Logs all approval actions.

**Table:** `expense_approvals`

| Column | Type | Description |
|--------|------|-------------|
| `approval_id` | Integer (PK) | Unique approval log identifier |
| `expense_id` | Integer (FK) | Reference to expense |
| `approver_id` | Integer (FK) | Reference to approver user |
| `flow_step_id` | Integer (FK) | Reference to workflow step |
| `status` | String | Approved, Rejected, or Escalated |
| `comments` | String | Approver comments |
| `approval_date` | DateTime | When action was taken |

**Relationships:**
- Many-to-One with `Expense`
- Many-to-One with `User` (approver)
- Many-to-One with `ApprovalFlowStep`

### API Schemas (Pydantic)

The application uses Pydantic for request/response validation and serialization.

#### Base Schemas (For Inheritance)

**CompanyBase**
```python
{
    "name": "string",
    "default_currency_code": "string"  # e.g., "USD", "EUR"
}
```

**UserBase**
```python
{
    "email": "user@example.com",
    "name": "string",
    "role": "string",  # "Admin", "Manager", or "Employee"
    "manager_id": int | null,
    "is_manager_approver": boolean  # default: false
}
```

**ExpenseCategoryBase**
```python
{
    "name": "string"  # e.g., "Travel", "Meals", "Office Supplies"
}
```

**ExpenseLineBase**
```python
{
    "category_id": int | null,
    "vendor_name": "string" | null,
    "date": "string" | null,  # Format: YYYY-MM-DD
    "amount_local": float,
    "description": "string" | null,
    "receipt_url": "string" | null,
    "expense_type": "string" | null
}
```

**ApprovalRuleBase**
```python
{
    "name": "string",
    "description": "string" | null,
    "is_active": boolean,  # default: true
    "threshold_amount": float,  # default: 0.0
    "approval_percentage": float  # default: 100.0 (0-100)
}
```

#### Create Schemas (Request Bodies)

**UserCreate**
Inherits all fields from `UserBase`. Used for creating new users (employees/managers).

**ExpenseLineCreate**
Inherits all fields from `ExpenseLineBase`. Used for creating expense line items.

**ExpenseCreate**
```python
{
    "description": "string" | null,
    "local_currency_code": "string",  # e.g., "GBP", "EUR"
    "expense_lines": [ExpenseLineCreate]  # Array of line items
}
```

**RequiredApproverCreate**
```python
{
    "user_id": int  # User ID of required approver
}
```

**NormalApproverCreate**
```python
{
    "user_id": int,  # User ID of normal approver
    "sequence": int  # Order in approval sequence
}
```

**ApprovalRuleCreate**
```python
{
    ...ApprovalRuleBase fields,
    "required_approvers": [RequiredApproverCreate],  # default: []
    "normal_approvers": [NormalApproverCreate]  # default: []
}
```

#### Update Schemas

**UserUpdate**
```python
{
    "name": "string" | null,
    "role": "string" | null,
    "manager_id": int | null,
    "is_manager_approver": boolean | null,
    "approval_rule_id": int | null
}
```
All fields are optional. Only provided fields will be updated.

#### Response Schemas (Full Objects)

**User**
```python
{
    ...UserBase fields,
    "user_id": int,
    "company_id": int
}
```

**ExpenseLine**
```python
{
    ...ExpenseLineBase fields,
    "line_id": int,
    "expense_id": int
}
```

**ExpenseApproval**
```python
{
    "approval_id": int,
    "approver_id": int,
    "status": "string",  # "Approved", "Rejected", "Escalated"
    "comments": "string" | null,
    "approval_date": "datetime"
}
```

**Expense**
```python
{
    "expense_id": int,
    "employee_id": int,
    "company_id": int,
    "submission_date": "datetime",
    "description": "string" | null,
    "status": "string",  # "Draft", "Submitted", "Pending", "Approved", "Rejected"
    "total_amount_local": float,
    "local_currency_code": "string",
    "exchange_rate": float | null,
    "total_amount_company_currency": float | null,
    "current_approval_step": int,
    "expense_lines": [ExpenseLine],
    "expense_approvals": [ExpenseApproval]
}
```

**RequiredApprover**
```python
{
    "id": int,
    "user_id": int,
    "sequence": int
}
```

**NormalApprover**
```python
{
    "id": int,
    "user_id": int,
    "sequence": int
}
```

**ApprovalRule**
```python
{
    ...ApprovalRuleBase fields,
    "rule_id": int,
    "company_id": int,
    "required_approvers": [RequiredApprover],
    "normal_approvers": [NormalApprover]
}
```

**ApprovalFlowStep**
```python
{
    "step_id": int,
    "rule_id": int,
    "step_sequence": int,
    "approver_type": "string",  # "Required" or "Normal"
    "target_value": "string" | null  # User ID
}
```

## Getting Started

These instructions assume you have Python 3.10+ installed. The backend uses SQLite by default and does not require any additional database server. The frontend is purely static and can be served with any local web server.

### Clone and Setup

1. Clone the repository and change into its root directory (the one containing `backend` and `frontend`):

```bash
git clone <your‑repo‑url>
cd Amalthea/AAA
```

2. Create and activate a virtual environment (recommended):

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

3. Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

### Running the Backend

1. Navigate to the backend directory:

```bash
cd backend
```

2. Start the FastAPI server with Uvicorn (hot‑reload enabled for development):

```bash
uvicorn main:app --reload --port 8000
```

The server will initialise the SQLite database (`expense_management.db`) on first run and expose the API at `http://127.0.0.1:8000/`. You can view interactive API documentation at `http://127.0.0.1:8000/docs`.

### Running the Frontend

Because the frontend makes cross‑origin requests to the backend, it must be served over HTTP (not opened directly as a file). There are many ways to do this; one simple approach is to use Python's built‑in HTTP server:

```bash
cd ../frontend
python3 -m http.server 5500
```

Then open your browser to `http://localhost:5500/index.html`. The CORS settings in `backend/main.py` already allow requests from common local ports (3000, 5500, 5501, 8000), but you can adjust the origins list if needed.

## Usage Overview

1. **Initial Sign‑Up** – On first run, no company exists. Use the sign‑up form to create a company by entering a company name, your admin email, a password and selecting the company's country. This creates both the company and the administrator. The admin's expenses are auto‑approved.

2. **Log In** – After sign‑up, log in using the email and password. The dashboard displays your role, company currency and personal expense history.

3. **Admin Actions** – As an admin you can:
   - Create new users (employees or managers), assign them managers and choose whether a manager is a "manager approver".
   - Define approval rules under the "Admin Tools" section. A rule consists of a threshold amount, required approvers (must all approve) and normal approvers (approve in order, optionally aggregated by a percentage threshold).
   - View and override any expense claim.

4. **Employee/Manager Actions** – Employees and managers can submit new expense claims by providing a description, currency and one or more line items. Each line item can include an expense category, vendor, date, amount, description and an optional receipt URL. After submission the claim enters the approval workflow.

5. **Approvals** – Approvers (managers or admins) can see all expenses waiting for their decision, view details, and approve or reject with optional comments. The workflow engine automatically advances to the next approver or finalises the claim based on the configured rule (percentage, specific approver or hybrid).

## API Reference (Summary)

The FastAPI backend exposes JSON endpoints under the following prefixes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/signup` | POST | Initial sign‑up. Creates a new company and admin user. |
| `/auth/login` | POST | Log in with email and password; returns a mock bearer token and user. |
| `/auth/users` | POST | Admin‑only: create an employee or manager. |
| `/expenses/` | GET | Get all expenses submitted by the current user. |
| `/expenses/` | POST | Create a new expense claim (all roles). |
| `/expenses/pending-approvals` | GET | List all expenses awaiting the current user's approval. |
| `/expenses/{id}/approve` | POST | Approve a pending expense. Body can include optional comments. |
| `/expenses/{id}/reject` | POST | Reject a pending expense with optional comments. |
| `/rules/` | GET | Get all approval rules defined for the company (requires auth). |
| `/rules/` | POST | Admin‑only: create a new approval rule with required and normal approvers. |
| `/companies/{id}` | GET | Retrieve company details (default currency, etc.). |

For a full description of request and response schemas, open the interactive docs at `/docs` after starting the server.

## Extending the Project

This project provides a solid foundation but deliberately leaves room for enhancements. Potential improvements include:

- **Real Authentication** – Replace the mock token logic in `core/auth_utils.py` and `security.py` with proper JSON Web Token (JWT) issuance and verification.

- **Persistent Database** – Swap the SQLite database for PostgreSQL or another production‑grade DBMS. Adjust `backend/db/database.py` and update the SQLAlchemy connection string accordingly.

- **Receipt OCR** – Integrate an OCR service (e.g. Google Vision, AWS Textract) to extract data from uploaded receipt images. Modify the expense submission flow to accept file uploads and parse them server‑side.

- **Frontend Framework** – Port the vanilla JavaScript frontend to a modern framework such as React, Vue or Svelte to improve state management and component reuse.

- **CI/CD & Testing** – Add unit tests for the API routes and UI, and configure continuous integration to run linting and tests on every commit.

## Acknowledgements

This project was created as a learning exercise and reference implementation of an expense management workflow. It draws inspiration from the problem statement provided in the accompanying PDF and makes use of several excellent open source projects:

- **FastAPI** – A fast web framework for building APIs with Python 3.7+ based on standard type hints.
- **SQLAlchemy** – The Python SQL toolkit and ORM that gives the flexibility to work with different databases.
- **Passlib & bcrypt** – Libraries for secure password hashing.
- **ExchangeRate‑API** – Free currency conversion API used for multi‑currency support.

Feel free to fork this repository, experiment with the code and adapt it to your own needs. Contributions and feedback are welcome!

---

