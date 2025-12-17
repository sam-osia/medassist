import ApiService from './ApiService';

const TOKEN_KEY = 'idToken';

class AuthService {
  // Check if user has a stored token
  hasToken() {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  // Get stored token
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  // Store token
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  // Clear token
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  // Check backend auth status
  async checkAuthStatus() {
    try {
      const response = await ApiService.get('/auth/auth-status');
      const skipAuth = response.data.skip_auth;

      // If auth is required, check if user has existing token
      if (!skipAuth) {
        return {
          skipAuth: false,
          hasToken: this.hasToken()
        };
      }

      return {
        skipAuth: true,
        hasToken: this.hasToken()
      };
    } catch (error) {
      console.error('Error checking auth status:', error);
      return {
        skipAuth: false,
        hasToken: this.hasToken()
      };
    }
  }

  // Login with username and password
  async login(username, password) {
    try {
      const response = await ApiService.post('/auth/login', {
        username,
        password
      });

      if (response.data.authenticated && response.data.token) {
        this.setToken(response.data.token);
        return {
          success: true,
          message: response.data.message || 'Login successful'
        };
      } else {
        return {
          success: false,
          message: 'Invalid response from server'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.response?.data?.detail || 'Login failed. Please try again.'
      };
    }
  }

  // Logout
  logout() {
    this.clearToken();
  }

  // Handle unauthorized responses (called by ApiService interceptor)
  handleUnauthorized() {
    this.clearToken();
    // Trigger auth state update by dispatching custom event
    window.dispatchEvent(new CustomEvent('auth-required'));
  }
}

export default new AuthService();