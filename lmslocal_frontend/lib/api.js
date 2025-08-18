// API helper functions for backend communication

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3015/api';

// Generic API call function
async function apiCall(endpoint, data = {}, options = {}) {
    try {
        console.log(`🌐 API Call: POST ${endpoint}`, data);

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: JSON.stringify(data),
            ...options
        });

        const result = await response.json();
        console.log(`📥 API Response (${response.status}):`, result);

        return {
            success: result.return_code === 'SUCCESS',
            data: result,
            status: response.status
        };

    } catch (error) {
        console.error('❌ API Error:', error);
        return {
            success: false,
            data: {
                return_code: 'NETWORK_ERROR',
                message: 'Failed to connect to server',
                error: error.message
            },
            status: 0
        };
    }
}

// Authentication API calls
export const auth = {
    // Send magic link to email
    requestLogin: async (email) => {
        return await apiCall('/auth/request-login', { email });
    },

    // Verify magic link token and get JWT
    verifyToken: async (token) => {
        return await apiCall('/auth/verify-token', { token });
    },

    // Validate JWT token
    validateJWT: async (jwt) => {
        return await apiCall('/auth/validate-jwt', { jwt });
    }
};

// Protected API calls (require JWT)
export const authenticated = {
    // Get user profile
    getProfile: async (jwt) => {
        return await apiCall('/protected/profile', {}, {
            headers: {
                'Authorization': `Bearer ${jwt}`
            }
        });
    }
};

// Organisation API calls
export const organisation = {
    // Create organisation
    create: async (data) => {
        return await apiCall('/organisation/create', data);
    },

    // Get organisation by ID or slug
    get: async (data) => {
        return await apiCall('/organisation/get', data);
    }
};

// User API calls
export const user = {
    // Create user
    create: async (data) => {
        return await apiCall('/user/create', data);
    },

    // Get user by ID or email
    get: async (data) => {
        return await apiCall('/user/get', data);
    }
};

// Competition API calls
export const competition = {
    // Get available team lists for competition creation
    getTeamLists: async (data) => {
        return await apiCall('/competition/team-lists', data, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.get()}`
            }
        });
    },

    // Create competition
    create: async (data) => {
        return await apiCall('/competition/create', data, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.get()}`
            }
        });
    },

    // Get competition by ID
    get: async (data) => {
        return await apiCall('/competition/get', data, {
            headers: {
                'Authorization': `Bearer ${token.get()}`
            }
        });
    }
};

// Health check
export const health = {
    check: async () => {
        return await apiCall('/health');
    }
};

// JWT Token management
export const token = {
    // Store JWT in localStorage
    store: (jwt) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('lms_jwt', jwt);
            console.log('🔑 JWT stored in localStorage');
        }
    },

    // Get JWT from localStorage
    get: () => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('lms_jwt');
        }
        return null;
    },

    // Remove JWT from localStorage
    remove: () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('lms_jwt');
            console.log('🗑️ JWT removed from localStorage');
        }
    },

    // Check if user is logged in
    isLoggedIn: () => {
        const jwt = token.get();
        return jwt !== null && jwt !== '';
    }
};