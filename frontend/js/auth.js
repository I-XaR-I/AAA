const API_BASE_URL = 'http://127.0.0.1:8000'; // Replace with your actual FastAPI URL

// --- Utility Functions ---

function toggleForm(formId) {
    const currentForm = document.querySelector('.form-card.active');
    const newForm = document.getElementById(`${formId}-form`);
    const messageElement = document.getElementById('message');
    
    // Clear any existing messages
    messageElement.textContent = '';
    messageElement.className = 'message';
    
    if (currentForm && currentForm !== newForm) {
        // Determine slide direction based on form order
        const forms = ['signup', 'login'];
        const currentIndex = forms.findIndex(id => currentForm.id === `${id}-form`);
        const newIndex = forms.findIndex(id => id === formId);
        
        // Add slide out animation
        currentForm.classList.add(currentIndex < newIndex ? 'slide-out-left' : 'slide-out-right');
        
        // Wait for animation to complete, then switch forms
        setTimeout(() => {
            currentForm.classList.remove('active', 'slide-out-left', 'slide-out-right');
            
            // Add slide in animation
            newForm.classList.add(currentIndex < newIndex ? 'slide-in-right' : 'slide-in-left');
            newForm.classList.add('active');
            
            // Remove slide in classes after animation
            setTimeout(() => {
                newForm.classList.remove('slide-in-left', 'slide-in-right');
            }, 300);
            
            // Focus first input in new form
            const firstInput = newForm.querySelector('input, select');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }, 300);
    }
}

function displayMessage(text, isError = true) {
    const msgElement = document.getElementById('message');
    
    // Clear previous message classes
    msgElement.className = 'message';
    
    // Add appropriate class for styling
    msgElement.classList.add(isError ? 'error' : 'success');
    
    // Set message text
    msgElement.textContent = text;
    
    // Add entrance animation
    msgElement.style.animation = 'none';
    setTimeout(() => {
        msgElement.style.animation = 'slideInUp 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    }, 10);
    
    // Auto-hide success messages after 5 seconds
    if (!isError) {
        setTimeout(() => {
            msgElement.style.opacity = '0';
            msgElement.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                msgElement.textContent = '';
                msgElement.className = 'message';
                msgElement.style.opacity = '';
                msgElement.style.transform = '';
            }, 300);
        }, 5000);
    }
}

function storeAuthToken(token) {
    localStorage.setItem('auth_token', token);
}

// --- API Call Handlers ---

// --- API Call Handlers ---

// Cache for countries data
let countriesCache = null;

async function populateCountries() {
    const customOptions = document.querySelector('.custom-options');
    const countryApiUrl = "https://restcountries.com/v3.1/all?fields=name,currencies";
    
    // Clear existing options (no placeholder in dropdown)
    customOptions.innerHTML = '';

    try {
        let data;
        
        // Check if data is already cached
        if (countriesCache) {
            console.log('Using cached countries data');
            data = countriesCache;
        } else {
            console.log('Fetching countries from API');
            const response = await fetch(countryApiUrl);
            
            if (!response.ok) {
                 throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            data = await response.json();
            
            // Store in cache
            countriesCache = data;
            
            // Also store in localStorage for persistence across sessions
            try {
                localStorage.setItem('countriesCache', JSON.stringify(data));
                localStorage.setItem('countriesCacheTime', Date.now().toString());
            } catch (e) {
                console.warn('Could not store countries in localStorage:', e);
            }
        }

        // Sort the data alphabetically by common name
        data.sort((a, b) => a.name.common.localeCompare(b.name.common));

        data.forEach(country => {
            const option = document.createElement('div');
            option.classList.add('custom-option');
            
            const countryName = country.name.common;
            const currencies = country.currencies;
            
            let currencyCode = 'N/A';
            
            if (currencies && Object.keys(currencies).length > 0) {
                currencyCode = Object.keys(currencies)[0]; 
            }
            
            option.setAttribute('data-value', `${countryName}|${currencyCode}`);
            option.textContent = `${countryName} (${currencyCode})`;
            
            customOptions.appendChild(option);
        });
        
        // Initialize custom dropdown functionality
        initCustomDropdown();
        
    } catch (error) {
        console.error("Failed to fetch or process countries:", error);
        displayMessage("Could not load countries due to an API error.", true);
    }
}

// Load countries from cache on initialization
function loadCountriesFromCache() {
    try {
        const cachedData = localStorage.getItem('countriesCache');
        const cacheTime = localStorage.getItem('countriesCacheTime');
        
        if (cachedData && cacheTime) {
            const now = Date.now();
            const oneWeek = 7 * 24 * 60 * 60 * 1000; // Cache for 1 week
            
            // Check if cache is still valid (less than 1 week old)
            if (now - parseInt(cacheTime) < oneWeek) {
                countriesCache = JSON.parse(cachedData);
                console.log('Loaded countries from localStorage cache');
            } else {
                // Cache expired, clear it
                localStorage.removeItem('countriesCache');
                localStorage.removeItem('countriesCacheTime');
                console.log('Countries cache expired, will fetch fresh data');
            }
        }
    } catch (e) {
        console.warn('Could not load countries from localStorage:', e);
    }
}

// Initialize custom dropdown
function initCustomDropdown() {
    const customSelect = document.getElementById('signup-country-selection');
    const customOptions = document.querySelector('.custom-options');
    const hiddenInput = document.getElementById('signup-country-selection-input');
    const trigger = customSelect.querySelector('.custom-select-trigger');
    
    // Toggle dropdown
    customSelect.addEventListener('click', function(e) {
        e.stopPropagation();
        this.classList.toggle('open');
        this.setAttribute('aria-expanded', this.classList.contains('open'));
    });
    
    // Handle option selection
    customOptions.addEventListener('click', function(e) {
        if (e.target.classList.contains('custom-option')) {
            const value = e.target.getAttribute('data-value');
            const text = e.target.textContent;
            
            // Update hidden input
            hiddenInput.value = value;
            
            // Update trigger text
            trigger.textContent = text;
            trigger.classList.remove('placeholder');
            
            // Remove previous selection
            customOptions.querySelectorAll('.custom-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            // Mark current selection
            e.target.classList.add('selected');
            
            // Close dropdown
            customSelect.classList.remove('open');
            customSelect.setAttribute('aria-expanded', 'false');
            
            // Update border color for validation feedback
            if (value) {
                customSelect.style.boxShadow = '0 0 0 1px rgba(81, 207, 102, 0.5), 0 8px 32px rgba(0, 0, 0, 0.2)';
            }
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!customSelect.contains(e.target) && !customOptions.contains(e.target)) {
            customSelect.classList.remove('open');
            customSelect.setAttribute('aria-expanded', 'false');
        }
    });
    
    // Keyboard navigation
    customSelect.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.classList.toggle('open');
            this.setAttribute('aria-expanded', this.classList.contains('open'));
        } else if (e.key === 'Escape') {
            this.classList.remove('open');
            this.setAttribute('aria-expanded', 'false');
        }
    });
    
    // Arrow key navigation in options
    customOptions.addEventListener('keydown', function(e) {
        const options = Array.from(this.querySelectorAll('.custom-option'));
        const currentIndex = options.findIndex(opt => opt === document.activeElement);
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = Math.min(currentIndex + 1, options.length - 1);
            options[nextIndex].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = Math.max(currentIndex - 1, 0);
            options[prevIndex].focus();
        }
    });
}

// Ensure you call this function on page load (as done in your original plan):
// document.addEventListener('DOMContentLoaded', populateCountries);

async function handleSignup(event) {
    if (event) event.preventDefault();
    
    const companyName = document.getElementById('signup-company-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const countryData = document.getElementById('signup-country-selection-input').value;
    const submitButton = document.querySelector('#signup-form button[type="submit"]');
    
    // Basic Frontend Validation
    if (password !== confirmPassword) {
        displayMessage("Passwords do not match.", true);
        return;
    }
    if (!companyName || !email || !password || !countryData) {
        displayMessage("All fields are required.", true);
        return;
    }
    if (password.length < 8) {
        displayMessage("Password must be at least 8 characters long.", true);
        return;
    }

    const [countryName, currencyCode] = countryData.split('|');
    
    // Show loading state
    submitButton.classList.add('loading');
    submitButton.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ company_name: companyName, email, password, currency: currencyCode })
        });

        const data = await response.json();
        
        if (response.ok) {
            storeAuthToken(data.access_token);
            displayMessage("Account created successfully! Redirecting...", false);
            
            // Add a small delay before redirect for better UX
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            displayMessage(data.detail || "Signup failed. Please try again.", true);
        }
    } catch (error) {
        console.error("Network error during signup:", error);
        displayMessage("A network error occurred. Check server connection.", true);
    } finally {
        // Remove loading state
        submitButton.classList.remove('loading');
        submitButton.disabled = false;
    }
}

async function handleLogin(event) {
    if (event) event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitButton = document.querySelector('#login-form button[type="submit"]');

    // Basic validation
    if (!email || !password) {
        displayMessage("Please fill in all fields.", true);
        return;
    }

    // Show loading state
    submitButton.classList.add('loading');
    submitButton.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            // FastAPI expects form-encoded data for standard token login
            body: `username=${email}&password=${password}`
        });

        const data = await response.json();
        
        if (response.ok) {
            storeAuthToken(data.access_token);
            displayMessage("Welcome back! Redirecting...", false);
            
            // Add a small delay before redirect for better UX
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            displayMessage(data.detail || "Invalid credentials. Please try again.", true);
        }
    } catch (error) {
        console.error("Network error during login:", error);
        displayMessage("A network error occurred. Check server connection.", true);
    } finally {
        // Remove loading state
        submitButton.classList.remove('loading');
        submitButton.disabled = false;
    }
}

// Add input animations and validation feedback
function addInputAnimations() {
    const inputs = document.querySelectorAll('input, select');
    
    inputs.forEach(input => {
        // Add focus/blur animations
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentElement.classList.remove('focused');
            }
        });
        
        // Real-time validation feedback
        input.addEventListener('input', function() {
            if (this.checkValidity()) {
                this.style.borderColor = 'rgba(81, 207, 102, 0.5)';
            } else if (this.value) {
                this.style.borderColor = 'rgba(255, 107, 107, 0.5)';
            } else {
                this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
        });
    });
}

// Add keyboard navigation
function addKeyboardNavigation() {
    document.addEventListener('keydown', function(e) {
        // ESC key to clear messages
        if (e.key === 'Escape') {
            const messageElement = document.getElementById('message');
            if (messageElement.textContent) {
                messageElement.textContent = '';
                messageElement.className = 'message';
            }
        }
        
        // Enter key on form to submit
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
            const activeForm = document.querySelector('.form-card.active');
            if (activeForm) {
                const submitButton = activeForm.querySelector('button[type="submit"]');
                if (submitButton && !submitButton.disabled) {
                    submitButton.click();
                }
            }
        }
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load countries from cache first
    loadCountriesFromCache();
    
    // Then populate the dropdown (will use cache if available)
    populateCountries();
    
    // Add event listeners to forms
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Add animations and interactions
    addInputAnimations();
    addKeyboardNavigation();
    
    // Default to the signup form as per the problem statement's focus on first-time setup
    toggleForm('signup');
    
    // Add entrance animation to the page
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.6s ease-in-out';
        document.body.style.opacity = '1';
    }, 100);
});