/**
 * Authentication utilities
 */

import type { User } from './api';

/**
 * Clears all authentication and session data from localStorage
 */
export const clearAuthData = () => {
  // Only clear our official tokens - leave rogue tokens for detection
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user');
  localStorage.removeItem('current_competition');
  
  // NOTE: We deliberately do NOT clear these potential rogue tokens:
  // - auth_token, lms_jwt, token
  // This allows us to detect if old cached code is still running
};

/**
 * Stores authentication data consistently, clearing old tokens first
 */
export const setAuthData = (token: string, user: User, additionalData: Record<string, unknown> = {}) => {
  // First clear any existing tokens to prevent conflicts
  clearAuthData();
  
  // Store new token and user data using consistent key names
  localStorage.setItem('jwt_token', token);
  localStorage.setItem('user', JSON.stringify(user));
  
  // Store any additional data (like competition info)
  Object.entries(additionalData).forEach(([key, value]) => {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  });
};

/**
 * Standard logout function that clears all data and redirects
 */
export const logout = async (router: { push: (path: string) => void }) => {
  // Clear authentication data from localStorage
  clearAuthData();

  // Clear all cached API data
  if (typeof window !== 'undefined') {
    const { cacheUtils } = await import('./cache');
    cacheUtils.clearAll();
  }

  // Trigger auth-expired event to reset AppDataContext state
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-expired'));
  }

  // Redirect to home page
  router.push('/');
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem('jwt_token');
  const userData = localStorage.getItem('user');
  return !!(token && userData);
};

/**
 * Get current user data from localStorage
 */
export const getCurrentUser = () => {
  const userData = localStorage.getItem('user');
  if (!userData) return null;
  
  try {
    return JSON.parse(userData);
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};