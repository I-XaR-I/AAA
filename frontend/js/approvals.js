async function loadApprovalManagement() {
    const dashboardContent = document.getElementById('dashboard-content');
    const userData = getUserData();
    
    // Fetch company currency
    let companyCurrency = 'USD';
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/companies/${userData.company_id}`);
        if (response.ok) {
            const company = await response.json();
            companyCurrency = company.default_currency_code;
        }
    } catch (error) {
        console.error('Could not fetch company currency:', error);
    }
    
    // Store company currency in userData for future use
    userData.company_currency = companyCurrency;
    localStorage.setItem('user_data', JSON.stringify(userData));
    
    dashboardContent.innerHTML = `
        <div class="welcome-section">
            <h2>Pending Approvals</h2>
            <p>Review and approve or reject expense claims that require your approval.</p>
            <p class="input-note">All amounts are displayed in your company currency: <strong>${companyCurrency}</strong></p>
            ${userData.role === 'Admin' ? '<p class="input-note">As an Admin, you may be designated as an approver in approval rules.</p>' : ''}
        </div>

        <section class="approvals-section">
            <div id="pending-approvals-list" data-company-currency="${companyCurrency}"></div>
        </section>
    `;

    await fetchPendingApprovals();
}

async function fetchPendingApprovals() {
    const container = document.getElementById('pending-approvals-list');
    const companyCurrency = container.getAttribute('data-company-currency') || 'USD';
    
    container.innerHTML = '<p class="loading-message">Loading pending approvals...</p>';

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/expenses/pending-approvals`);

        if (!response.ok) {
            throw new Error('Failed to fetch pending approvals');
        }

        const expenses = await response.json();
        
        console.log('Pending approvals:', expenses);
        console.log('Company currency:', companyCurrency);

        if (expenses.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; background: var(--surface-glass); border-radius: 24px;">
                    <p class="empty-message" style="font-size: 1.1rem; margin-bottom: 0.5rem;">No pending approvals at this time.</p>
                    <p class="input-note">Expenses will appear here when they require your approval.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = expenses.map(expense => {
            // Determine if currency conversion occurred
            const showConversion = expense.local_currency_code !== companyCurrency;
            const displayAmount = expense.total_amount_company_currency || expense.total_amount_local;
            const displayCurrency = companyCurrency;
            const exchangeRate = expense.exchange_rate || 1.0;
            
            console.log(`Expense ${expense.expense_id} - Exchange Rate Debug:`, {
                local: expense.total_amount_local,
                localCurrency: expense.local_currency_code,
                converted: expense.total_amount_company_currency,
                companyCurrency: companyCurrency,
                exchangeRate: exchangeRate,
                rawExchangeRate: expense.exchange_rate,
                showConversion: showConversion
            });
            
            return `
            <div class="approval-card" style="background: var(--surface-glass); backdrop-filter: var(--blur-backdrop); border: 1px solid rgba(255,255,255,0.1); padding: 2rem; border-radius: 24px; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                    <div>
                        <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">Expense #${expense.expense_id}</h3>
                        <p style="color: var(--text-secondary);">${expense.description || 'No description'}</p>
                        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">
                            Submitted: ${new Date(expense.submission_date).toLocaleDateString()} by Employee ID: ${expense.employee_id}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                            ${displayAmount.toFixed(2)} ${displayCurrency}
                        </p>
                        ${showConversion && expense.exchange_rate && expense.exchange_rate !== 1.0 ? `
                            <div style="background: rgba(79, 172, 254, 0.1); padding: 0.5rem 1rem; border-radius: 8px; margin-bottom: 0.5rem;">
                                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
                                    Original: ${expense.total_amount_local.toFixed(2)} ${expense.local_currency_code}
                                </p>
                                <p style="font-size: 0.85rem; color: var(--text-muted);">
                                    Rate: 1 ${expense.local_currency_code} = ${expense.exchange_rate.toFixed(4)} ${companyCurrency}
                                </p>
                            </div>
                        ` : ''}
                        <span class="status-${expense.status.toLowerCase()}">${expense.status}</span>
                    </div>
                </div>

                <div class="expense-lines-preview" style="margin-bottom: 1.5rem;">
                    <h4 style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.75rem;">Line Items:</h4>
                    ${expense.expense_lines.map(line => {
                        const lineAmountInCompanyCurrency = showConversion && expense.exchange_rate
                            ? (line.amount_local * expense.exchange_rate).toFixed(2)
                            : line.amount_local.toFixed(2);
                        
                        return `
                        <div style="padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 0.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <span style="font-weight: 500;">${line.vendor_name || 'N/A'}</span>
                                    ${line.description ? `<span style="color: var(--text-muted);"> - ${line.description}</span>` : ''}
                                    ${line.date ? `<span style="color: var(--text-muted); font-size: 0.85rem;"> (${line.date})</span>` : ''}
                                    ${line.receipt_url ? `<br><span style="color: var(--text-muted); font-size: 0.85rem;">📎 Receipt attached</span>` : ''}
                                </div>
                                <div style="text-align: right; margin-left: 1rem;">
                                    <div style="font-weight: 600; color: var(--text-primary);">${lineAmountInCompanyCurrency} ${displayCurrency}</div>
                                    ${showConversion && expense.exchange_rate && expense.exchange_rate !== 1.0 ? `<div style="font-size: 0.85em; color: var(--text-muted);">(${line.amount_local.toFixed(2)} ${expense.local_currency_code})</div>` : ''}
                                </div>
                            </div>
                        </div>
                    `}).join('')}
                </div>

                <div class="approval-actions" style="display: flex; gap: 1rem;">
                    <input type="text" id="comments-${expense.expense_id}" placeholder="Add comments (optional for approval, required for rejection)" style="flex: 1; padding: 0.75rem; background: var(--surface-glass); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: var(--text-primary);">
                    <button onclick="approveExpense(${expense.expense_id})" style="padding: 0.75rem 1.5rem; background: var(--success-gradient); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600;">
                        Approve
                    </button>
                    <button onclick="rejectExpense(${expense.expense_id})" style="padding: 0.75rem 1.5rem; background: var(--error-gradient); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600;">
                        Reject
                    </button>
                </div>
            </div>
        `}).join('');

    } catch (error) {
        console.error('Error fetching pending approvals:', error);
        container.innerHTML = '<p class="error-message">Failed to load pending approvals. Please try again.</p>';
    }
}

async function approveExpense(expenseId) {
    const commentsInput = document.getElementById(`comments-${expenseId}`);
    const comments = commentsInput ? commentsInput.value.trim() : '';

    console.log(`Approving expense ${expenseId} with comments:`, comments);

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/expenses/${expenseId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ comments: comments || null })
        });

        if (response.ok) {
            alert('Expense approved successfully!');
            await fetchPendingApprovals();
        } else {
            const error = await response.json();
            alert(error.detail || 'Failed to approve expense');
        }
    } catch (error) {
        console.error('Error approving expense:', error);
        alert('Network error. Please try again.');
    }
}

async function rejectExpense(expenseId) {
    const commentsInput = document.getElementById(`comments-${expenseId}`);
    
    // Debug logging
    console.log('=== REJECT EXPENSE DEBUG ===');
    console.log('Expense ID:', expenseId);
    console.log('Comments input element:', commentsInput);
    console.log('Input exists:', !!commentsInput);
    
    if (!commentsInput) {
        alert('Error: Comments input field not found. Please refresh the page.');
        return;
    }
    
    const comments = commentsInput.value.trim();
    
    console.log('Raw value:', commentsInput.value);
    console.log('Trimmed value:', comments);
    console.log('Value length:', comments.length);
    console.log('Is empty?', !comments || comments.length === 0);
    
    if (!comments || comments.length === 0) {
        alert('Please provide a reason for rejection in the comments field');
        commentsInput.focus();
        commentsInput.style.borderColor = 'rgba(250, 112, 154, 0.8)';
        setTimeout(() => {
            commentsInput.style.borderColor = '';
        }, 2000);
        return;
    }

    console.log('Sending rejection with comments:', comments);

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/expenses/${expenseId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ comments: comments })
        });

        if (response.ok) {
            alert('Expense rejected successfully');
            await fetchPendingApprovals();
        } else {
            const error = await response.json();
            alert(error.detail || 'Failed to reject expense');
        }
    } catch (error) {
        console.error('Error rejecting expense:', error);
        alert('Network error. Please try again.');
    }
}
