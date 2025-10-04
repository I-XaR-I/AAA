// From AAA/frontend/js/dashboard.js

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) {
        return;
    }
    
    initDashboard();
});

function getRole() {
    const userData = getUserData();
    return userData ? userData.role : null;
}

async function initDashboard() {
    const userData = getUserData();
    const role = getRole();
    const dashboardContent = document.getElementById('dashboard-content');
    const userNameElement = document.getElementById('user-name');
    const titleElement = document.getElementById('dashboard-title');

    if (!userData || !role) {
        console.error("User data or role missing. Logging out.");
        return logout();
    }
    
    // Fetch company currency if not already cached
    if (!userData.company_currency) {
        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/companies/${userData.company_id}`);
            if (response.ok) {
                const company = await response.json();
                userData.company_currency = company.default_currency_code;
                localStorage.setItem('user_data', JSON.stringify(userData));
            }
        } catch (error) {
            console.error('Could not fetch company currency:', error);
            userData.company_currency = 'USD'; // Fallback
        }
    }
    
    // Update Header
    userNameElement.textContent = `${userData.name} (${role})`;
    titleElement.textContent = `${role} Dashboard - ExpenseFlow`;

    // Show navigation buttons based on role - Employee and Manager have same access
    if (role === 'Employee' || role === 'Manager') {
        document.getElementById('approvals-btn').style.display = 'inline-block';
    }
    
    if (role === 'Admin') {
        document.getElementById('admin-btn').style.display = 'inline-block';
        // Admin can also see approvals
        document.getElementById('approvals-btn').style.display = 'inline-block';
    }

    // Default: Show expense history
    let contentHtml = `
        <div class="welcome-section">
            <h2>Welcome Back, ${userData.name}!</h2>
            <p>You are logged in as a <strong>${role}</strong>.</p>
            <p class="input-note">Company Currency: <strong>${userData.company_currency || 'USD'}</strong></p>
            ${role === 'Admin' ? '<p class="input-note">Your expenses are auto-approved and don\'t require approval workflow.</p>' : ''}
        </div>
        <section class="expense-history-section">
            <h3>My Expense Claims</h3>
            <div class="table-container">
                <table class="expense-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="expense-list">
                        <tr><td colspan="5" class="loading-message">Loading expenses...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>
    `;

    dashboardContent.innerHTML = contentHtml;
    
    try {
        await fetchUserExpenses();
    } catch (error) {
        console.error('Error fetching expenses:', error);
    }
}


// This function is the same as the one implemented in the previous step
async function fetchUserExpenses() {
    const expenseList = document.getElementById('expense-list');
    if (!expenseList) return;

    expenseList.innerHTML = '<tr><td colspan="5" class="loading-message">Fetching data...</td></tr>';
    
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/expenses/`); 

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch expenses.');
        }

        const expenses = await response.json();
        const userData = getUserData();
        
        // Fetch company currency if not in userData
        let companyCurrency = userData?.company_currency;
        if (!companyCurrency) {
            try {
                const companyResponse = await authenticatedFetch(`${API_BASE_URL}/companies/${userData.company_id}`);
                if (companyResponse.ok) {
                    const company = await companyResponse.json();
                    companyCurrency = company.default_currency_code;
                    // Update localStorage
                    userData.company_currency = companyCurrency;
                    localStorage.setItem('user_data', JSON.stringify(userData));
                }
            } catch (error) {
                console.error('Error fetching company currency:', error);
                companyCurrency = 'USD'; // Fallback
            }
        }
        
        console.log('Company currency for expenses:', companyCurrency);
        
        expenseList.innerHTML = ''; 

        if (expenses.length === 0) {
            expenseList.innerHTML = '<tr><td colspan="5" class="empty-message">You have no expense claims submitted.</td></tr>';
            return;
        }

        expenses.forEach(expense => {
            const row = document.createElement('tr');
            
            const date = new Date(expense.submission_date).toLocaleDateString();
            
            // Show both local and converted amounts if different currencies
            let amountDisplay = '';
            const showConversion = expense.local_currency_code !== companyCurrency;
            
            if (showConversion && expense.total_amount_company_currency) {
                amountDisplay = `
                    <div>
                        <strong>${expense.total_amount_company_currency.toFixed(2)} ${companyCurrency}</strong>
                        <div style="font-size: 0.85em; color: var(--text-muted);">
                            (${expense.total_amount_local.toFixed(2)} ${expense.local_currency_code})
                        </div>
                    </div>
                `;
            } else {
                amountDisplay = `${expense.total_amount_local.toFixed(2)} ${expense.local_currency_code}`;
            }

            row.innerHTML = `
                <td>${expense.expense_id}</td>
                <td>${date}</td>
                <td>${expense.description || '-'}</td>
                <td>${amountDisplay}</td>
                <td><span class="status-${expense.status.toLowerCase()}">${expense.status}</span></td>
            `;
            expenseList.appendChild(row);
        });

    } catch (error) {
        console.error('Error fetching expenses:', error);
        expenseList.innerHTML = `<tr><td colspan="5" class="error-message">Error: ${error.message}</td></tr>`;
    }
}