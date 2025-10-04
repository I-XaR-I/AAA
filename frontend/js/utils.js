const API_BASE_URL = 'http://127.0.0.1:8000';

// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('auth_token');
}

// Check if user is authenticated
function isAuthenticated() {
    return !!getAuthToken();
}

// Redirect to login if not authenticated
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// Logout function
function logout() {
    localStorage.removeItem('auth_token');
    window.location.href = 'index.html';
}

// Make authenticated API request
async function authenticatedFetch(url, options = {}) {
    const token = getAuthToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return fetch(url, {
        ...options,
        headers
    });
}

function getUserData() {
    const userJson = localStorage.getItem('user_data');
    return userJson ? JSON.parse(userJson) : null;
}

// Store user data (called after successful login/signup)
function storeUserData(userObject) {
    localStorage.setItem('user_data', JSON.stringify(userObject));
    // Also, update the logout function to remove user_data
    // NOTE: For brevity, we assume the user modifies handleSignup/handleLogin in auth.js
    // to call this function: storeUserData(data.user);
}

// Export for use in other files (Update the export block)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_BASE_URL,
        getAuthToken,
        isAuthenticated,
        requireAuth,
        logout,
        authenticatedFetch,
        // ADDED EXPORTS:
        getUserData,
        storeUserData
    };
}