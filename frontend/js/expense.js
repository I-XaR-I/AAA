let expenseLines = [];
let currenciesCache = null;

async function loadCurrenciesForExpense() {
    const currencySelect = document.getElementById('expense-currency-select');
    const countryApiUrl = "https://restcountries.com/v3.1/all?fields=name,currencies";
    
    if (!currencySelect) return;
    
    try {
        let data;
        
        // Check cache first
        if (currenciesCache) {
            data = currenciesCache;
        } else {
            const response = await fetch(countryApiUrl);
            if (!response.ok) throw new Error('Failed to fetch currencies');
            data = await response.json();
            currenciesCache = data;
        }
        
        // Extract unique currencies
        const currenciesSet = new Set();
        data.forEach(country => {
            if (country.currencies) {
                Object.keys(country.currencies).forEach(code => {
                    const currency = country.currencies[code];
                    currenciesSet.add(JSON.stringify({ code, name: currency.name, symbol: currency.symbol || code }));
                });
            }
        });
        
        // Convert to array and sort
        const currencies = Array.from(currenciesSet).map(c => JSON.parse(c)).sort((a, b) => a.code.localeCompare(b.code));
        
        // Populate dropdown
        let options = '<option value="" disabled selected>Select Currency</option>';
        currencies.forEach(curr => {
            options += `<option value="${curr.code}">${curr.code} - ${curr.name} (${curr.symbol})</option>`;
        });
        
        currencySelect.innerHTML = options;
        
        // Initialize custom dropdown
        initSingleExpenseCurrencyDropdown();
        
    } catch (error) {
        console.error("Failed to fetch currencies:", error);
        currencySelect.innerHTML = '<option value="" disabled selected>Error loading currencies</option>';
    }
}

function initSingleExpenseCurrencyDropdown() {
    const selectElement = document.getElementById('expense-currency-select');
    if (!selectElement) return;
    
    const wrapper = selectElement.closest('.custom-select-wrapper');
    if (!wrapper) return;

    const customSelect = wrapper.querySelector('.custom-select');
    const trigger = wrapper.querySelector('.custom-select-trigger');
    const optionsContainer = wrapper.querySelector('.custom-options');

    if (!customSelect || !trigger || !optionsContainer) return;

    // Clear and populate custom options
    optionsContainer.innerHTML = '';
    
    Array.from(selectElement.options).forEach((option) => {
        const customOption = document.createElement('div');
        customOption.classList.add('custom-option');
        customOption.setAttribute('data-value', option.value);
        customOption.textContent = option.textContent;
        
        if (option.selected && option.value !== '') {
            trigger.textContent = option.textContent;
            trigger.classList.remove('placeholder');
            customOption.classList.add('selected');
        } else if (option.selected && option.value === '') {
            trigger.textContent = option.textContent;
            trigger.classList.add('placeholder');
        }
        
        optionsContainer.appendChild(customOption);
    });

    // Remove any existing event listeners by cloning
    const newCustomSelect = customSelect.cloneNode(true);
    const newOptionsContainer = optionsContainer.cloneNode(true);
    
    customSelect.parentNode.replaceChild(newCustomSelect, customSelect);
    optionsContainer.parentNode.replaceChild(newOptionsContainer, optionsContainer);
    
    // Get fresh references
    const freshCustomSelect = wrapper.querySelector('.custom-select');
    const freshOptionsContainer = wrapper.querySelector('.custom-options');
    const freshTrigger = wrapper.querySelector('.custom-select-trigger');

    // Toggle dropdown
    freshCustomSelect.addEventListener('click', function(e) {
        e.stopPropagation();
        document.querySelectorAll('.custom-select.open').forEach(other => {
            if (other !== freshCustomSelect) {
                other.classList.remove('open');
                other.setAttribute('aria-expanded', 'false');
            }
        });
        this.classList.toggle('open');
        this.setAttribute('aria-expanded', this.classList.contains('open'));
    });

    // Handle option selection
    freshOptionsContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('custom-option')) {
            const value = e.target.getAttribute('data-value');
            const text = e.target.textContent;

            // Update hidden select
            selectElement.value = value;
            
            // Remove required attribute error
            selectElement.setCustomValidity('');
            
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            selectElement.dispatchEvent(event);

            // Update trigger text
            freshTrigger.textContent = text;
            if (value === '') {
                freshTrigger.classList.add('placeholder');
            } else {
                freshTrigger.classList.remove('placeholder');
            }

            // Update selected state
            freshOptionsContainer.querySelectorAll('.custom-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            e.target.classList.add('selected');

            // Close dropdown
            freshCustomSelect.classList.remove('open');
            freshCustomSelect.setAttribute('aria-expanded', 'false');
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!wrapper.contains(e.target)) {
            freshCustomSelect.classList.remove('open');
            freshCustomSelect.setAttribute('aria-expanded', 'false');
        }
    });
}

function loadExpenseSubmissionForm() {
    const dashboardContent = document.getElementById('dashboard-content');
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    dashboardContent.innerHTML = `
        <div class="welcome-section">
            <h2>Submit New Expense</h2>
            <p>Add your expense details and line items below.</p>
        </div>

        <section class="expense-form-section">
            <form id="expense-submission-form" novalidate>
                <div class="input-group">
                    <label for="expense-description">Description</label>
                    <textarea id="expense-description" placeholder="Brief description of the expense" rows="3" style="width: 100%; padding: 1rem; background: var(--surface-glass); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; color: var(--text-primary); resize: vertical;"></textarea>
                </div>

                <div class="input-group">
                    <label for="expense-currency-select">Currency *</label>
                    <div class="custom-select-wrapper">
                        <select id="expense-currency-select" style="display: none;">
                            <option value="" disabled selected>Loading currencies...</option>
                        </select>
                        <div class="custom-select" tabindex="0" role="combobox" aria-expanded="false">
                            <span class="custom-select-trigger placeholder">Loading currencies...</span>
                            <div class="custom-select-arrow">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                        </div>
                        <div class="custom-options" role="listbox"></div>
                    </div>
                </div>

                <h3>Expense Line Items</h3>
                <div class="line-item-form">
                    <div class="input-group">
                        <input type="text" id="line-vendor" placeholder="Vendor/Restaurant Name">
                    </div>
                    <div class="input-group">
                        <input type="date" id="line-date" value="${today}">
                    </div>
                    <div class="input-group">
                        <input type="number" id="line-amount" placeholder="Amount" step="0.01">
                    </div>
                    <div class="input-group">
                        <input type="text" id="line-description" placeholder="Item Description">
                    </div>
                    <div class="input-group" style="margin-bottom: 1rem;">
                        <label for="line-receipt" style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">Attach Receipt (Optional)</label>
                        <input type="file" id="line-receipt" accept="image/*" style="width: 100%; padding: 0.75rem; background: var(--surface-glass); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: var(--text-primary); cursor: pointer;">
                        <span class="input-note" style="display: block; margin-top: 0.5rem;">Upload receipt image (JPG, PNG, or PDF)</span>
                    </div>
                    <button type="button" class="btn-secondary" onclick="addExpenseLine()" style="background: var(--success-gradient);">
                        Add Line Item
                    </button>
                </div>

                <div id="expense-lines-list" class="expense-lines-list"></div>

                <button type="submit" class="btn-primary"><span class="btn-text">Submit Expense</span></button>
                <div id="expense-submit-message" class="message"></div>
            </form>
        </section>
    `;

    document.getElementById('expense-submission-form').addEventListener('submit', handleExpenseSubmission);
    
    // Load currencies
    loadCurrenciesForExpense();
}

function addExpenseLine() {
    const vendor = document.getElementById('line-vendor').value;
    const date = document.getElementById('line-date').value;
    const amount = parseFloat(document.getElementById('line-amount').value);
    const description = document.getElementById('line-description').value;
    const receiptInput = document.getElementById('line-receipt');
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    // Handle receipt file
    let receiptUrl = null;
    if (receiptInput.files && receiptInput.files[0]) {
        const file = receiptInput.files[0];
        // In production, you would upload this to a server and get a URL
        // For now, we'll create a local object URL
        receiptUrl = URL.createObjectURL(file);
        console.log('Receipt attached:', file.name);
    }

    expenseLines.push({
        vendor_name: vendor,
        date: date,
        amount_local: amount,
        description: description,
        receipt_url: receiptUrl,
        receipt_filename: receiptInput.files && receiptInput.files[0] ? receiptInput.files[0].name : null
    });

    renderExpenseLines();
    
    // Clear form and reset date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('line-vendor').value = '';
    document.getElementById('line-date').value = today;
    document.getElementById('line-amount').value = '';
    document.getElementById('line-description').value = '';
    document.getElementById('line-receipt').value = '';
}

function renderExpenseLines() {
    const container = document.getElementById('expense-lines-list');
    
    if (expenseLines.length === 0) {
        container.innerHTML = '<p class="input-note">No line items added</p>';
        return;
    }

    const total = expenseLines.reduce((sum, line) => sum + line.amount_local, 0);

    container.innerHTML = `
        ${expenseLines.map((line, index) => `
            <div class="expense-line-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--surface-glass); border-radius: 12px; margin-bottom: 0.5rem;">
                <div style="flex: 1;">
                    <strong>${line.vendor_name || 'N/A'}</strong>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">${line.description || ''} - ${line.date || 'No date'}</p>
                    ${line.receipt_filename ? `<p style="color: var(--text-muted); font-size: 0.85rem;">📎 ${line.receipt_filename}</p>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span style="font-weight: 600;">${line.amount_local.toFixed(2)}</span>
                    <button type="button" onclick="removeExpenseLine(${index})" style="background: var(--error-gradient); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer;">
                        Remove
                    </button>
                </div>
            </div>
        `).join('')}
        <div style="text-align: right; margin-top: 1rem; font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">
            Total: ${total.toFixed(2)}
        </div>
    `;
}

function removeExpenseLine(index) {
    expenseLines.splice(index, 1);
    renderExpenseLines();
}

async function handleExpenseSubmission(event) {
    event.preventDefault();
    event.stopPropagation();

    const description = document.getElementById('expense-description').value;
    const currency = document.getElementById('expense-currency-select').value;
    const messageElement = document.getElementById('expense-submit-message');

    // Clear any previous messages
    messageElement.textContent = '';
    messageElement.className = 'message';
    messageElement.style.display = 'none';

    // Validation
    if (expenseLines.length === 0) {
        messageElement.textContent = 'Please add at least one line item';
        messageElement.className = 'message error';
        messageElement.style.display = 'block';
        return false;
    }

    if (!currency || currency === '') {
        messageElement.textContent = 'Please select a currency';
        messageElement.className = 'message error';
        messageElement.style.display = 'block';
        
        // Highlight the currency dropdown
        const currencySelect = document.querySelector('#expense-currency-select + .custom-select');
        if (currencySelect) {
            currencySelect.style.boxShadow = '0 0 0 2px rgba(250, 112, 154, 0.5)';
            setTimeout(() => {
                currencySelect.style.boxShadow = '';
            }, 2000);
        }
        return false;
    }

    // Show loading state
    messageElement.textContent = 'Submitting expense...';
    messageElement.className = 'message';
    messageElement.style.display = 'block';

    try {
        const expenseData = {
            description: description,
            local_currency_code: currency,
            expense_lines: expenseLines
        };

        console.log('Submitting expense:', expenseData);

        const response = await authenticatedFetch(`${API_BASE_URL}/expenses/`, {
            method: 'POST',
            body: JSON.stringify(expenseData)
        });

        const data = await response.json();

        if (response.ok) {
            messageElement.textContent = 'Expense submitted successfully!';
            messageElement.className = 'message success';
            messageElement.style.display = 'block';
            
            // Reset form
            document.getElementById('expense-submission-form').reset();
            expenseLines = [];
            renderExpenseLines();
            
            // Reset currency dropdown
            const currencySelect = document.getElementById('expense-currency-select');
            const currencyTrigger = document.querySelector('#expense-currency-select + .custom-select .custom-select-trigger');
            if (currencySelect) currencySelect.value = '';
            if (currencyTrigger) {
                currencyTrigger.textContent = 'Select Currency';
                currencyTrigger.classList.add('placeholder');
            }
            
            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            messageElement.textContent = data.detail || 'Failed to submit expense';
            messageElement.className = 'message error';
            messageElement.style.display = 'block';
        }
    } catch (error) {
        console.error('Error submitting expense:', error);
        messageElement.textContent = 'Network error. Please try again.';
        messageElement.className = 'message error';
        messageElement.style.display = 'block';
    }
    
    return false;
}
