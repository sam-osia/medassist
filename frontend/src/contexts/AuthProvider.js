import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [refreshToken, setRefreshToken] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Check for existing tokens on mount
    useEffect(() => {
        checkAuth();
    }, []);

    // Auto-refresh access token when close to expiring
    useEffect(() => {
        const interval = setInterval(() => {
            const token = localStorage.getItem('accessToken');
            if (token) {
                try {
                    const decoded = jwtDecode(token);
                    const timeUntilExpiry = decoded.exp - (Date.now() / 1000);

                    // Refresh if less than 2 minutes remaining
                    if (timeUntilExpiry < 120 && timeUntilExpiry > 0) {
                        refreshAccessToken();
                    }
                } catch (error) {
                    console.error('Error checking token expiry:', error);
                }
            }
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, []);

    // Listen for logout events from API interceptor
    useEffect(() => {
        const handleLogout = () => logout();
        window.addEventListener('auth:logout', handleLogout);
        return () => window.removeEventListener('auth:logout', handleLogout);
    }, []);

    const fetchCurrentUserInfo = async () => {
        try {
            const { default: ApiService } = await import('../services/ApiService');
            const response = await ApiService.get('/auth/me');
            const userData = response.data;

            setUser(userData.username);
            setIsAdmin(userData.is_admin || false);

            return true;
        } catch (error) {
            console.error('Error fetching user info:', error);
            return false;
        }
    };

    const checkAuth = async () => {
        try {
            const storedAccessToken = localStorage.getItem('accessToken');
            const storedRefreshToken = localStorage.getItem('refreshToken');

            if (storedAccessToken && storedRefreshToken) {
                // Decode access token to check expiry
                const decoded = jwtDecode(storedAccessToken);
                const currentTime = Date.now() / 1000;

                if (decoded.exp > currentTime) {
                    // Access token is still valid
                    setAccessToken(storedAccessToken);
                    setRefreshToken(storedRefreshToken);
                    setUser(decoded.sub);
                    setIsAuthenticated(true);

                    // Fetch user info to get admin status
                    await fetchCurrentUserInfo();
                } else {
                    // Access token expired, try to refresh
                    const refreshed = await refreshAccessToken();
                    if (!refreshed) {
                        logout();
                    }
                }
            }
        } catch (error) {
            console.error('Error checking auth:', error);
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (username, password) => {
        try {
            // Import ApiService dynamically to avoid circular dependencies
            const { default: ApiService } = await import('../services/ApiService');

            const response = await ApiService.post('/auth/login', {
                username,
                password
            });

            const { access_token, refresh_token } = response.data;

            // Store both tokens in localStorage
            localStorage.setItem('accessToken', access_token);
            localStorage.setItem('refreshToken', refresh_token);

            // Decode access token to get username
            const decoded = jwtDecode(access_token);

            // Update state
            setAccessToken(access_token);
            setRefreshToken(refresh_token);
            setUser(decoded.sub);
            setIsAuthenticated(true);

            // Fetch user info to get admin status
            await fetchCurrentUserInfo();

            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            const errorMessage = error.response?.data?.detail || 'Login failed. Please try again.';
            return { success: false, error: errorMessage };
        }
    };

    const refreshAccessToken = async () => {
        try {
            const storedRefreshToken = localStorage.getItem('refreshToken');
            if (!storedRefreshToken) {
                return false;
            }

            const { default: ApiService } = await import('../services/ApiService');

            const response = await ApiService.post('/auth/refresh', {
                refresh_token: storedRefreshToken
            });

            const { access_token } = response.data;

            // Update access token
            localStorage.setItem('accessToken', access_token);
            setAccessToken(access_token);

            // Decode to get username (shouldn't change, but update anyway)
            const decoded = jwtDecode(access_token);
            setUser(decoded.sub);

            console.log('Access token refreshed successfully');
            return true;
        } catch (error) {
            console.error('Token refresh error:', error);
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        setIsAdmin(false);
        setIsAuthenticated(false);
    };

    const value = {
        user,
        accessToken,
        refreshToken,
        isAuthenticated,
        isAdmin,
        isLoading,
        login,
        logout,
        checkAuth,
        refreshAccessToken
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;