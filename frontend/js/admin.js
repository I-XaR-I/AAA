// From AAA/frontend/js/admin.js

let allCompanyUsersCache = [];
let requiredApprovers = [];
let normalApprovers = [];

function getAllUsersOptionsHtml(dropdownId, selectType = 'default') {
    if (allCompanyUsersCache.length === 0) {
        return `<option value="" disabled selected>Loading Users...</option>`;
    }
    
    let options = ''; 
    
    if (selectType === 'required-approver') {
        options = `<option value="" disabled selected>Select Required Approver</option>`;
    } else if (selectType === 'normal-approver') {
        options = `<option value="" disabled selected>Select Normal Approver</option>`;
    } else { // Manager Select
        options = `<option value="" disabled selected>Select Manager</option>`;
    }
    
    const adminUser = getUserData();
    
    allCompanyUsersCache.forEach(user => {
        let isSelected = '';
        
        // For the new user creation form, select the Admin as default manager
        if (selectType === 'manager' && user.user_id === adminUser.user_id) {
            isSelected = 'selected';
        }

        options += `<option value="${user.user_id}" ${isSelected}>${user.name} (${user.role} ID: ${user.user_id})</option>`;
    });
    
    return options;
}

function initCustomDashboardDropdowns() {
    // Initialize all custom dropdowns in the dashboard
    const dropdowns = [
        { selectId: 'new-user-role', triggerId: 'new-user-role-trigger' },
        { selectId: 'new-user-manager', triggerId: 'new-user-manager-trigger' },
        { selectId: 'required-approver-user-id', triggerId: 'required-approver-user-id-trigger' },
        { selectId: 'user-select-for-rule', triggerId: 'user-select-for-rule-trigger' },
        { selectId: 'approval-rule-select', triggerId: 'approval-rule-select-trigger' }
    ];

    dropdowns.forEach(({ selectId, triggerId }) => {
        const selectElement = document.getElementById(selectId);
        if (selectElement) {
            initSingleCustomDropdown(selectId, triggerId);
        }
    });
}

function initSingleCustomDropdown(selectId, triggerId) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) {
        console.warn(`Select element not found: ${selectId}`);
        return;
    }
    
    const wrapper = selectElement.closest('.custom-select-wrapper');
    if (!wrapper) {
        console.warn(`Wrapper not found for: ${selectId}`);
        return;
    }

    const customSelect = wrapper.querySelector('.custom-select');
    const trigger = wrapper.querySelector('.custom-select-trigger');
    const optionsContainer = wrapper.querySelector('.custom-options');

    if (!customSelect || !trigger || !optionsContainer) {
        console.warn(`Missing elements for dropdown: ${selectId}`, {
            customSelect: !!customSelect,
            trigger: !!trigger,
            optionsContainer: !!optionsContainer
        });
        return;
    }

    // Clear and populate custom options from select element
    optionsContainer.innerHTML = '';
    
    const options = Array.from(selectElement.options);
    
    options.forEach((option) => {
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

    // Remove any existing listeners before adding new ones
    const newCustomSelect = customSelect.cloneNode(true);
    customSelect.parentNode.replaceChild(newCustomSelect, customSelect);
    
    // IMPORTANT: Also clone the options container to maintain structure
    const newOptionsContainer = optionsContainer.cloneNode(true);
    optionsContainer.parentNode.replaceChild(newOptionsContainer, optionsContainer);
    
    // Get fresh references
    const freshCustomSelect = wrapper.querySelector('.custom-select');
    const freshOptionsContainer = wrapper.querySelector('.custom-options');
    const freshTrigger = wrapper.querySelector('.custom-select-trigger');

    // Toggle dropdown
    freshCustomSelect.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // Close all other dropdowns
        document.querySelectorAll('.custom-select.open').forEach(other => {
            if (other !== freshCustomSelect) {
                other.classList.remove('open');
                other.setAttribute('aria-expanded', 'false');
            }
        });
        
        this.classList.toggle('open');
        this.setAttribute('aria-expanded', this.classList.contains('open'));
    });

    // Handle option selection - ENHANCED FIX
    freshOptionsContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('custom-option')) {
            const value = e.target.getAttribute('data-value');
            const text = e.target.textContent;

            console.log(`${selectId} - Option clicked:`, { value, text });

            // CRITICAL: Update hidden select element's value FIRST
            selectElement.value = value;
            
            // Force a small delay to ensure the value is set
            setTimeout(() => {
                console.log(`${selectId} - Verified select value:`, selectElement.value);
            }, 0);
            
            // Trigger change event on original select
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
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.custom-select')) {
        document.querySelectorAll('.custom-select.open').forEach(select => {
            select.classList.remove('open');
            select.setAttribute('aria-expanded', 'false');
        });
    }
});

async function fetchCompanyManagers() { 
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/auth/managers`);
        
        if (response.ok) {
            allCompanyUsersCache = await response.json();
            
            console.log('Fetched users:', allCompanyUsersCache); // Debug log
            
            // Update all user dropdowns
            const managerDropdown = document.getElementById('new-user-manager');
            if (managerDropdown) {
                 managerDropdown.innerHTML = getAllUsersOptionsHtml('new-user-manager', 'manager');
                 initSingleCustomDropdown('new-user-manager', 'new-user-manager-trigger');
            }
            
            const requiredApproverDropdown = document.getElementById('required-approver-select');
            if (requiredApproverDropdown) {
                 requiredApproverDropdown.innerHTML = getAllUsersOptionsHtml('required-approver-select', 'required-approver');
                 initSingleCustomDropdown('required-approver-select', 'required-approver-select-trigger');
            }
            
            const normalApproverDropdown = document.getElementById('normal-approver-select');
            if (normalApproverDropdown) {
                 normalApproverDropdown.innerHTML = getAllUsersOptionsHtml('normal-approver-select', 'normal-approver');
                 initSingleCustomDropdown('normal-approver-select', 'normal-approver-select-trigger');
            }
            
            const userSelectForRule = document.getElementById('user-select-for-rule');
            if (userSelectForRule) {
                updateUserSelectForRule();
                initSingleCustomDropdown('user-select-for-rule', 'user-select-for-rule-trigger');
            }

        } else {
            console.error("Failed to fetch users.");
        }
    } catch (error) {
        console.error("Network error fetching users:", error);
    }
}

function updateUserSelectForRule() {
    const userSelect = document.getElementById('user-select-for-rule');
    if (!userSelect || allCompanyUsersCache.length === 0) return;
    
    let options = '<option value="" disabled selected>Select User</option>';
    
    allCompanyUsersCache.forEach(user => {
        options += `<option value="${user.user_id}">${user.name} (${user.role} - ID: ${user.user_id})</option>`;
    });
    
    userSelect.innerHTML = options;
}

async function loadAdminDashboard() {
    const userData = getUserData();
    const dashboardContent = document.getElementById('dashboard-content');
    
    dashboardContent.innerHTML = `
        <div class="welcome-section">
            <h2>Admin Tools: User & Rule Management</h2>
            <p>Create user accounts and define their approval rules.</p>
        </div>

        <section class="admin-user-management-section">
            <div class="user-form-container">
                <h3>Create New User</h3>
                <form id="create-user-form">
                    <div class="input-group"><input type="text" id="new-user-name" placeholder="Full Name" required></div>
                    <div class="input-group"><input type="email" id="new-user-email" placeholder="Email Address" required></div>
                    <div class="input-group"><input type="password" id="new-user-password" placeholder="Password (min 8 chars)" required minlength="8"></div>
                    
                    <div class="input-group">
                        <div class="custom-select-wrapper">
                            <select id="new-user-role" required onchange="toggleManagerFields(this.value)" style="display: none;">
                                <option value="" disabled selected>Select Role</option>
                                <option value="Employee">Employee</option>
                                <option value="Manager">Manager</option>
                            </select>
                            <div class="custom-select" tabindex="0" role="combobox" aria-expanded="false">
                                <span class="custom-select-trigger placeholder">Select Role</span>
                                <div class="custom-select-arrow">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </div>
                            </div>
                            <div class="custom-options" role="listbox"></div>
                        </div>
                    </div>

                    <div id="manager-assignment-section">
                        <h4>Manager Assignment</h4>
                        <div class="input-group">
                            <div class="custom-select-wrapper">
                                <select id="new-user-manager" required style="display: none;">
                                    <option value="" disabled selected>Loading Users...</option>
                                </select>
                                <div class="custom-select" tabindex="0" role="combobox" aria-expanded="false">
                                    <span class="custom-select-trigger placeholder">Loading Users...</span>
                                    <div class="custom-select-arrow">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </div>
                                </div>
                                <div class="custom-options" role="listbox"></div>
                            </div>
                            <span class="input-note">Any user can be assigned as a manager. Default is the Admin.</span>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn-primary"><span class="btn-text">Create Account</span></button>
                    <div id="admin-message" class="message" role="alert" aria-live="polite"></div>
                </form>
            </div>
            
            <div class="rule-form-container">
                <h3>Assign Approval Rules to Users</h3>
                <p class="input-note">Select a user to assign or modify their approval rule.</p>
                
                <div class="input-group">
                    <div class="custom-select-wrapper">
                        <select id="user-select-for-rule" onchange="handleUserSelectionForRule(this.value)" style="display: none;">
                            <option value="" disabled selected>Loading Users...</option>
                        </select>
                        <div class="custom-select" tabindex="0" role="combobox" aria-expanded="false">
                            <span class="custom-select-trigger placeholder">Loading Users...</span>
                            <div class="custom-select-arrow">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                        </div>
                        <div class="custom-options" role="listbox"></div>
                    </div>
                </div>

                <div id="rule-assignment-container" style="display: none;">
                    <h4>Approval Rule for <span id="selected-user-name"></span></h4>
                    <div class="input-group">
                        <div class="custom-select-wrapper">
                            <select id="approval-rule-select" style="display: none;">
                                <option value="" disabled selected>Select Approval Rule</option>
                            </select>
                            <div class="custom-select" tabindex="0" role="combobox" aria-expanded="false">
                                <span class="custom-select-trigger placeholder">Select Approval Rule</span>
                                <div class="custom-select-arrow">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </div>
                            </div>
                            <div class="custom-options" role="listbox"></div>
                        </div>
                    </div>
                    <button type="button" class="btn-primary" onclick="assignRuleToUser()">
                        <span class="btn-text">Assign Rule</span>
                    </button>
                </div>

                <hr style="margin: 2rem 0; border: 1px solid rgba(255,255,255,0.1);">

                <h3>Configure Approval Rules</h3>
                <p class="input-note">Create a rule with required and normal approvers.</p>
                <form id="create-rule-form">
                    <div class="input-group">
                        <input type="text" id="rule-name" placeholder="Rule Name (e.g., High-Value Claims)" required>
                    </div>
                    
                    <div class="input-group">
                        <textarea id="rule-description" placeholder="Rule Description (Optional)" rows="2" style="width: 100%; padding: 1rem; background: var(--surface-glass); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; color: var(--text-primary); resize: vertical;"></textarea>
                    </div>

                    <div class="input-group">
                        <label for="approval-percentage" style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">Normal Approver Percentage Required</label>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <input type="range" id="approval-percentage" min="0" max="100" value="100" step="5" style="flex: 1;" oninput="updatePercentageDisplay(this.value)">
                            <span id="percentage-display" style="font-weight: 600; font-size: 1.25rem; color: var(--text-primary); min-width: 60px; text-align: right;">100%</span>
                        </div>
                        <span class="input-note">Percentage of normal approvers that must approve after all required approvers have approved. Set to 100% to require all normal approvers.</span>
                    </div>

                    <h4>Required Approvers (Must approve before normal approvers)</h4>
                    <div class="input-group">
                        <div class="custom-select-wrapper">
                            <select id="required-approver-select" style="display: none;">
                                <option value="" disabled selected>Loading Users...</option>
                            </select>
                            <div class="custom-select" tabindex="0" role="combobox" aria-expanded="false">
                                <span class="custom-select-trigger placeholder">Loading Users...</span>
                                <div class="custom-select-arrow">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </div>
                            </div>
                            <div class="custom-options" role="listbox"></div>
                        </div>
                        <button type="button" class="btn-secondary" onclick="addRequiredApprover()" style="margin-top: 0.5rem; background: var(--accent-gradient);">
                            Add Required Approver
                        </button>
                    </div>
                    
                    <div id="required-approvers-list" class="approvers-list"></div>

                    <h4>Normal Approvers (Sequential approval after required)</h4>
                    <div class="input-group">
                        <div class="custom-select-wrapper">
                            <select id="normal-approver-select" style="display: none;">
                                <option value="" disabled selected>Loading Users...</option>
                            </select>
                            <div class="custom-select" tabindex="0" role="combobox" aria-expanded="false">
                                <span class="custom-select-trigger placeholder">Loading Users...</span>
                                <div class="custom-select-arrow">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </div>
                            </div>
                            <div class="custom-options" role="listbox"></div>
                        </div>
                        <button type="button" class="btn-secondary" onclick="addNormalApprover()" style="margin-top: 0.5rem; background: var(--success-gradient);">
                            Add Normal Approver
                        </button>
                    </div>
                    
                    <div id="normal-approvers-list" class="approvers-list"></div>

                    <button type="submit" class="btn-primary"><span class="btn-text">Save Approval Rule</span></button>
                </form>
            </div>
        </section>
    `;
    
    document.getElementById('create-user-form').addEventListener('submit', handleAdminCreateUser);
    document.getElementById('create-rule-form').addEventListener('submit', handleCreateApprovalRule);
    
    // Initialize custom dropdowns for role selection immediately
    setTimeout(() => {
        initSingleCustomDropdown('new-user-role', 'new-user-role-trigger');
    }, 50);
    
    // Fetch users asynchronously and update dropdowns when ready
    await fetchCompanyManagers();
}

function updatePercentageDisplay(value) {
    document.getElementById('percentage-display').textContent = value + '%';
}

async function fetchApprovalRules(currentUserId = null) {
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/rules/`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch approval rules');
        }
        
        const rules = await response.json();
        console.log('Fetched approval rules:', rules);
        
        const ruleSelect = document.getElementById('approval-rule-select');
        
        if (!ruleSelect) {
            console.error('Rule select element not found');
            return;
        }
        
        let options = '<option value="" disabled selected>Select Approval Rule</option>';
        options += '<option value="none">No Rule (Remove Assignment)</option>';
        
        rules.forEach(rule => {
            const reqCount = rule.required_approvers ? rule.required_approvers.length : 0;
            const normCount = rule.normal_approvers ? rule.normal_approvers.length : 0;
            const percentage = rule.approval_percentage || 100;
            const normNeeded = Math.ceil(normCount * (percentage / 100));
            
            const description = rule.description || `${reqCount} required, ${normNeeded}/${normCount} normal (${percentage}%)`;
            options += `<option value="${rule.rule_id}">${rule.name} - ${description}</option>`;
        });
        
        ruleSelect.innerHTML = options;
        
        console.log('Rules populated in dropdown:', ruleSelect.innerHTML);
        
        // Re-initialize the custom dropdown
        initSingleCustomDropdown('approval-rule-select', 'approval-rule-select-trigger');
        
    } catch (error) {
        console.error('Error fetching approval rules:', error);
        alert('Failed to load approval rules. Please try again.');
    }
}

async function assignRuleToUser() {
    const userId = document.getElementById('user-select-for-rule').value;
    const ruleId = document.getElementById('approval-rule-select').value;
    
    if (!userId) {
        alert('Please select a user');
        return;
    }
    
    if (!ruleId) {
        alert('Please select an approval rule');
        return;
    }
    
    try {
        const updateData = {
            approval_rule_id: ruleId === 'none' ? null : parseInt(ruleId)
        };
        
        console.log('Assigning rule to user:', userId, updateData);
        
        const response = await authenticatedFetch(`${API_BASE_URL}/auth/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to assign rule');
        }
        
        const result = await response.json();
        console.log('Rule assigned successfully:', result);
        
        alert('Approval rule assigned successfully!');
        
        // Reset the form
        const userSelectTrigger = document.querySelector('#user-select-for-rule + .custom-select .custom-select-trigger');
        if (userSelectTrigger) {
            userSelectTrigger.textContent = 'Select User';
            userSelectTrigger.classList.add('placeholder');
        }
        document.getElementById('user-select-for-rule').value = '';
        document.getElementById('rule-assignment-container').style.display = 'none';
        
        // Re-initialize the dropdown
        initSingleCustomDropdown('user-select-for-rule', 'user-select-for-rule-trigger');
        
    } catch (error) {
        console.error('Error assigning rule:', error);
        alert('Error: ' + error.message);
    }
}

async function handleAdminCreateUser(event) {
    event.preventDefault();
    
    const name = document.getElementById('new-user-name').value;
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    const managerId = document.getElementById('new-user-manager').value;
    const messageElement = document.getElementById('admin-message');
    
    // Validation
    if (!name || !email || !password || !role || !managerId) {
        messageElement.textContent = 'Please fill in all required fields.';
        messageElement.className = 'message error';
        messageElement.style.display = 'block';
        return;
    }
    
    if (password.length < 8) {
        messageElement.textContent = 'Password must be at least 8 characters long.';
        messageElement.className = 'message error';
        messageElement.style.display = 'block';
        return;
    }
    
    // Show loading state
    messageElement.textContent = 'Creating user account...';
    messageElement.className = 'message';
    messageElement.style.display = 'block';
    
    try {
        const userData = {
            name: name,
            email: email,
            password: password,
            role: role,
            manager_id: parseInt(managerId),
            is_manager_approver: false
        };
        
        console.log('Creating user with data:', userData);
        
        const response = await authenticatedFetch(`${API_BASE_URL}/auth/users`, {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Success notification
            messageElement.textContent = `✅ Success! User "${data.name}" (${data.role}) has been created with email ${data.email}.`;
            messageElement.className = 'message success';
            messageElement.style.display = 'block';
            
            // Clear form
            document.getElementById('create-user-form').reset();
            
            // Reset custom dropdowns to placeholder state
            const roleDropdown = document.querySelector('#new-user-role + .custom-select .custom-select-trigger');
            const managerDropdown = document.querySelector('#new-user-manager + .custom-select .custom-select-trigger');
            
            if (roleDropdown) {
                roleDropdown.textContent = 'Select Role';
                roleDropdown.classList.add('placeholder');
            }
            if (managerDropdown) {
                managerDropdown.textContent = 'Select Manager';
                managerDropdown.classList.add('placeholder');
            }
            
            // Refresh the user list
            await fetchCompanyManagers();
            
            // Auto-hide success message after 5 seconds
            setTimeout(() => {
                messageElement.style.opacity = '0';
                setTimeout(() => {
                    messageElement.textContent = '';
                    messageElement.className = 'message';
                    messageElement.style.display = 'none';
                    messageElement.style.opacity = '1';
                }, 300);
            }, 5000);
            
        } else if (response.status === 409) {
            // Duplicate user notification
            messageElement.textContent = `⚠️ A user with email "${email}" already exists in the system. Please use a different email address.`;
            messageElement.className = 'message error';
            messageElement.style.display = 'block';
        } else if (response.status === 403) {
            // Permission error
            messageElement.textContent = '🚫 Access denied. Only Admin users can create new accounts.';
            messageElement.className = 'message error';
            messageElement.style.display = 'block';
        } else {
            // Generic error notification
            messageElement.textContent = `❌ Failed to create user: ${data.detail || 'Unknown error occurred. Please try again.'}`;
            messageElement.className = 'message error';
            messageElement.style.display = 'block';
        }
    } catch (error) {
        console.error('Error creating user:', error);
        messageElement.textContent = '❌ Network error occurred. Please check your connection and try again.';
        messageElement.className = 'message error';
        messageElement.style.display = 'block';
    }
}

function addRequiredApprover() {
    const selectElement = document.getElementById('required-approver-select');
    
    if (!selectElement) {
        alert('Dropdown not found. Please refresh the page.');
        return;
    }
    
    // CRITICAL FIX: Get the value directly from the select element
    const selectedValue = selectElement.value;
    const userId = parseInt(selectedValue);
    
    console.log('=== ADD REQUIRED APPROVER DEBUG ===');
    console.log('Select element value:', selectedValue);
    console.log('Parsed user ID:', userId);
    console.log('Is NaN?', isNaN(userId));
    console.log('All users cache:', allCompanyUsersCache);
    
    // Validate
    if (!selectedValue || selectedValue === '' || isNaN(userId)) {
        // Try to get the value from the custom dropdown trigger as fallback
        const wrapper = selectElement.closest('.custom-select-wrapper');
        const trigger = wrapper?.querySelector('.custom-select-trigger');
        const triggerText = trigger?.textContent;
        
        console.log('Trigger text:', triggerText);
        
        // Check if there's a selected option in the custom dropdown
        const selectedOption = wrapper?.querySelector('.custom-option.selected');
        if (selectedOption) {
            const fallbackValue = selectedOption.getAttribute('data-value');
            console.log('Found selected option with value:', fallbackValue);
            if (fallbackValue && fallbackValue !== '') {
                // Update the select element
                selectElement.value = fallbackValue;
                // Recursively call this function to try again
                addRequiredApprover();
                return;
            }
        }
        
        alert('Please select a user from the dropdown first');
        return;
    }
    
    const user = allCompanyUsersCache.find(u => u.user_id === userId);
    if (!user) {
        console.error('User not found in cache:', userId);
        alert('User not found. Please try again.');
        return;
    }
    
    if (requiredApprovers.find(a => a.user_id === userId)) {
        alert('This user is already added as a required approver');
        return;
    }
    
    requiredApprovers.push({ user_id: userId, name: user.name });
    console.log('✅ Required approvers after adding:', requiredApprovers);
    renderRequiredApprovers();
    
    // Reset dropdown
    selectElement.value = '';
    const wrapper = selectElement.closest('.custom-select-wrapper');
    if (wrapper) {
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const options = wrapper.querySelectorAll('.custom-option');
        if (trigger) {
            trigger.textContent = 'Select Required Approver';
            trigger.classList.add('placeholder');
        }
        options.forEach(opt => opt.classList.remove('selected'));
    }
}

function addNormalApprover() {
    const selectElement = document.getElementById('normal-approver-select');
    
    if (!selectElement) {
        alert('Dropdown not found. Please refresh the page.');
        return;
    }
    
    // CRITICAL FIX: Get the value directly from the select element
    const selectedValue = selectElement.value;
    const userId = parseInt(selectedValue);
    
    console.log('=== ADD NORMAL APPROVER DEBUG ===');
    console.log('Select element value:', selectedValue);
    console.log('Parsed user ID:', userId);
    console.log('Is NaN?', isNaN(userId));
    
    // Validate
    if (!selectedValue || selectedValue === '' || isNaN(userId)) {
        // Try to get the value from the custom dropdown trigger as fallback
        const wrapper = selectElement.closest('.custom-select-wrapper');
        const trigger = wrapper?.querySelector('.custom-select-trigger');
        const triggerText = trigger?.textContent;
        
        console.log('Trigger text:', triggerText);
        
        // Check if there's a selected option in the custom dropdown
        const selectedOption = wrapper?.querySelector('.custom-option.selected');
        if (selectedOption) {
            const fallbackValue = selectedOption.getAttribute('data-value');
            console.log('Found selected option with value:', fallbackValue);
            if (fallbackValue && fallbackValue !== '') {
                // Update the select element
                selectElement.value = fallbackValue;
                // Recursively call this function to try again
                addNormalApprover();
                return;
            }
        }
        
        alert('Please select a user from the dropdown first');
        return;
    }
    
    const user = allCompanyUsersCache.find(u => u.user_id === userId);
    if (!user) {
        console.error('User not found in cache:', userId);
        alert('User not found. Please try again.');
        return;
    }
    
    if (normalApprovers.find(a => a.user_id === userId)) {
        alert('This user is already added as a normal approver');
        return;
    }
    
    normalApprovers.push({ user_id: userId, name: user.name, sequence: normalApprovers.length + 1 });
    console.log('✅ Normal approvers after adding:', normalApprovers);
    renderNormalApprovers();
    
    // Reset dropdown
    selectElement.value = '';
    const wrapper = selectElement.closest('.custom-select-wrapper');
    if (wrapper) {
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const options = wrapper.querySelectorAll('.custom-option');
        if (trigger) {
            trigger.textContent = 'Select Normal Approver';
            trigger.classList.add('placeholder');
        }
        options.forEach(opt => opt.classList.remove('selected'));
    }
}

function renderRequiredApprovers() {
    const container = document.getElementById('required-approvers-list');
    
    if (requiredApprovers.length === 0) {
        container.innerHTML = '<p class="input-note">No required approvers added</p>';
        return;
    }
    
    container.innerHTML = requiredApprovers.map((approver, index) => `
        <div class="approver-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(79, 172, 254, 0.1); border-radius: 12px; margin-bottom: 0.5rem;">
            <span>${approver.name}</span>
            <button type="button" onclick="removeRequiredApprover(${index})" style="background: var(--error-gradient); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer;">
                Remove
            </button>
        </div>
    `).join('');
}

function renderNormalApprovers() {
    const container = document.getElementById('normal-approvers-list');
    
    if (normalApprovers.length === 0) {
        container.innerHTML = '<p class="input-note">No normal approvers added</p>';
        return;
    }
    
    container.innerHTML = normalApprovers.map((approver, index) => `
        <div class="approver-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(67, 233, 123, 0.1); border-radius: 12px; margin-bottom: 0.5rem;">
            <span>Step ${approver.sequence}: ${approver.name}</span>
            <div style="display: flex; gap: 0.5rem;">
                ${index > 0 ? `<button type="button" onclick="moveNormalApprover(${index}, 'up')" style="background: var(--accent-gradient); color: white; border: none; padding: 0.5rem; border-radius: 8px; cursor: pointer;">↑</button>` : ''}
                ${index < normalApprovers.length - 1 ? `<button type="button" onclick="moveNormalApprover(${index}, 'down')" style="background: var(--accent-gradient); color: white; border: none; padding: 0.5rem; border-radius: 8px; cursor: pointer;">↓</button>` : ''}
                <button type="button" onclick="removeNormalApprover(${index})" style="background: var(--error-gradient); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer;">
                    Remove
                </button>
            </div>
        </div>
    `).join('');
}

function removeRequiredApprover(index) {
    requiredApprovers.splice(index, 1);
    renderRequiredApprovers();
}

function removeNormalApprover(index) {
    normalApprovers.splice(index, 1);
    normalApprovers.forEach((a, i) => a.sequence = i + 1);
    renderNormalApprovers();
}

function moveNormalApprover(index, direction) {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= normalApprovers.length) return;
    
    [normalApprovers[index], normalApprovers[newIndex]] = [normalApprovers[newIndex], normalApprovers[index]];
    normalApprovers.forEach((a, i) => a.sequence = i + 1);
    renderNormalApprovers();
}

async function handleCreateApprovalRule(event) {
    event.preventDefault();
    
    const ruleName = document.getElementById('rule-name').value;
    const ruleDescription = document.getElementById('rule-description').value;
    const approvalPercentage = parseFloat(document.getElementById('approval-percentage').value);
    
    console.log('=== CREATING APPROVAL RULE ===');
    console.log('Rule name:', ruleName);
    console.log('Approval percentage:', approvalPercentage);
    console.log('Required approvers array:', requiredApprovers);
    console.log('Normal approvers array:', normalApprovers);
    
    if (!ruleName) {
        alert('Please enter a rule name.');
        return;
    }
    
    const totalApprovers = requiredApprovers.length + normalApprovers.length;
    
    if (totalApprovers === 0) {
        alert(`Please add at least one approver (required or normal).\n\nDebugging info:\n- Required approvers: ${requiredApprovers.length}\n- Normal approvers: ${normalApprovers.length}\n- Total: ${totalApprovers}`);
        return;
    }
    
    try {
        // Calculate how many normal approvers are needed based on percentage
        const normalApproversNeeded = Math.ceil(normalApprovers.length * (approvalPercentage / 100));
        
        const ruleData = {
            name: ruleName,
            description: ruleDescription || `${requiredApprovers.length} required approvers, ${normalApproversNeeded} of ${normalApprovers.length} normal approvers (${approvalPercentage}%)`,
            is_active: true,
            threshold_amount: 0.0,
            approval_percentage: approvalPercentage,
            required_approvers: requiredApprovers.map(a => ({ user_id: a.user_id })),
            normal_approvers: normalApprovers.map(a => ({ user_id: a.user_id, sequence: a.sequence }))
        };
        
        console.log('Sending rule data to API:', JSON.stringify(ruleData, null, 2));
        
        const response = await authenticatedFetch(`${API_BASE_URL}/rules/`, {
            method: 'POST',
            body: JSON.stringify(ruleData)
        });
        
        const data = await response.json();
        console.log('Rule creation response:', data);
        
        if (response.ok) {
            const reqCount = data.required_approvers ? data.required_approvers.length : 0;
            const normCount = data.normal_approvers ? data.normal_approvers.length : 0;
            const normNeeded = Math.ceil(normCount * (approvalPercentage / 100));
            
            alert(`✅ Approval rule "${data.name}" created successfully!\n\n📋 Details:\n- Required approvers: ${reqCount}\n- Normal approvers: ${normCount}\n- Approval percentage: ${approvalPercentage}%\n- Normal approvers needed: ${normNeeded} of ${normCount}`);
            
            document.getElementById('create-rule-form').reset();
            document.getElementById('approval-percentage').value = 100;
            document.getElementById('percentage-display').textContent = '100%';
            requiredApprovers = [];
            normalApprovers = [];
            renderRequiredApprovers();
            renderNormalApprovers();
            
            const selectedUserId = document.getElementById('user-select-for-rule').value;
            if (selectedUserId) {
                await fetchApprovalRules(selectedUserId);
            }
        } else {
            alert('❌ Failed to create approval rule: ' + (data.detail || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error creating approval rule:', error);
        alert('❌ Network error. Please try again.');
    }
}

function toggleManagerFields(selectedRole) {
    const managerSection = document.getElementById('manager-assignment-section');
    
    if (selectedRole === 'Employee') {
        managerSection.style.display = 'block';
    } else if (selectedRole === 'Manager') {
        // Managers can also have managers, so keep it visible
        managerSection.style.display = 'block';
    }
}

// Ensure loadAdminDashboard is available globally for dashboard.js
if (typeof loadAdminDashboard === 'undefined') {
    window.loadAdminDashboard = loadAdminDashboard;
}

async function handleUserSelectionForRule(userId) {
    console.log('User selected for rule assignment:', userId);
    
    if (!userId || userId === '') {
        document.getElementById('rule-assignment-container').style.display = 'none';
        return;
    }
    
    // Find the selected user from cache
    const selectedUser = allCompanyUsersCache.find(u => u.user_id === parseInt(userId));
    
    if (!selectedUser) {
        console.error('Selected user not found in cache');
        return;
    }
    
    // Update the UI to show the selected user's name
    document.getElementById('selected-user-name').textContent = selectedUser.name;
    
    // Show the rule assignment container
    document.getElementById('rule-assignment-container').style.display = 'block';
    
    // Fetch and populate approval rules
    await fetchApprovalRules(userId);
}