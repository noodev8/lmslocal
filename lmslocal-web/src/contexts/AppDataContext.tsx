'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { userApi } from '@/lib/api';
import { Competition, User } from '@/lib/api';
import '@/lib/cache';

interface AppDataContextType {
  // Data
  competitions: Competition[] | null;
  user: User | null;
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshData: () => void;
  refreshCompetitions: () => void;
  forceRefresh: () => Promise<void>;
  
  // Metadata
  lastUpdated: number | null;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

interface AppDataProviderProps {
  children: ReactNode;
}

export const AppDataProvider: React.FC<AppDataProviderProps> = ({ children }) => {
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const loadAppData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if user is authenticated first
      const token = localStorage.getItem('jwt_token');
      const userData = localStorage.getItem('user');
      
      if (!token || !userData) {
        setLoading(false);
        return;
      }
      
      // Parse user data from localStorage
      try {
        const parsedUser = JSON.parse(userData) as User;
        setUser(parsedUser);
      } catch (parseError) {
        console.error('Error parsing user data:', parseError);
        setUser(null);
      }
      
      // Load app-level data using unified user dashboard API
      const competitionsData = await userApi.getUserDashboard();
      
      // Handle competitions response
      if (competitionsData.data.return_code === 'SUCCESS') {
        setCompetitions((competitionsData.data.competitions as Competition[]) || []);
      } else {
        console.error('Failed to load competitions:', competitionsData.data.message);
        setCompetitions([]);
      }
      
      setLastUpdated(Date.now());
      
    } catch (err) {
      console.error('Error loading app data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load app data');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    loadAppData();
  };

  const forceRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Clear all dashboard-related cache
      const { cacheUtils } = await import('@/lib/cache');
      const userId = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).id : null;
      
      if (userId) {
        cacheUtils.invalidateKey(`user-dashboard-${userId}`);
        cacheUtils.invalidatePattern(`competition-*`);
        cacheUtils.invalidatePattern(`dashboard-*`);
      }
      
      // Force fresh API call with cache-busting parameters and headers
      const { default: axios } = await import('axios');
      const timestamp = Date.now();
      
      // Create a new axios instance for this force refresh with cache-busting headers
      const freshApi = axios.create({
        baseURL: `http://${window.location.hostname}:3015`,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      
      // Add JWT token to fresh API
      const token = localStorage.getItem('jwt_token');
      if (token) {
        freshApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      
      const competitionsData = await freshApi.post('/get-user-dashboard', {
        _t: timestamp, // Cache buster
        _mobile: true  // Mobile refresh flag
      });
      
      if (competitionsData.data.return_code === 'SUCCESS') {
        setCompetitions((competitionsData.data.competitions as Competition[]) || []);
        setLastUpdated(timestamp);
        setError(null); // Clear any previous errors
        console.log('✅ Force refresh successful');
      } else {
        console.error('Failed to force refresh:', competitionsData.data.message);
        setError(`Refresh failed: ${competitionsData.data.message}`);
      }
      
    } catch (err) {
      console.error('Error during force refresh:', err);
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      setError(`Force refresh failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshCompetitions = async (bypassCache = false) => {
    try {
      // Check if user is authenticated
      const token = localStorage.getItem('jwt_token');
      if (!token) return;
      
      let competitionsData;
      
      if (bypassCache) {
        // Make direct API call bypassing cache completely
        const api = (await import('@/lib/api')).default;
        competitionsData = await api.post('/get-user-dashboard', {});
      } else {
        // Use normal cached API call
        competitionsData = await userApi.getUserDashboard();
      }
      
      if (competitionsData.data.return_code === 'SUCCESS') {
        setCompetitions((competitionsData.data.competitions as Competition[]) || []);
        setLastUpdated(Date.now());
      } else {
        console.error('Failed to refresh competitions:', competitionsData.data.message);
      }
    } catch (err) {
      console.error('Error refreshing competitions:', err);
    }
  };

  // Load data only when authenticated and on appropriate pages
  useEffect(() => {
    // Don't load data on public pages
    if (typeof window !== 'undefined') {
      const publicPages = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
      const currentPath = window.location.pathname;
      const isPublicPage = publicPages.some(page => currentPath.startsWith(page));
      
      if (isPublicPage) {
        setLoading(false);
        return;
      }
    }
    
    // Only load if we have authentication data
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      loadAppData();
    } else {
      setLoading(false);
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setCompetitions(null);
      setLoading(false);
    };

    const handleAuthSuccess = async () => {
      // Clear all cache on login for fresh start
      const { cacheUtils } = await import('@/lib/cache');
      cacheUtils.clearAll();
      console.log('🧹 Fresh login - cleared all cache for clean start');
      
      // Reload data after successful login
      loadAppData();
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    window.addEventListener('auth-success', handleAuthSuccess);

    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
      window.removeEventListener('auth-success', handleAuthSuccess);
    };
  }, []);

  const value: AppDataContextType = {
    competitions,
    user,
    loading,
    error,
    refreshData,
    refreshCompetitions,
    forceRefresh,
    lastUpdated
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
};

// Custom hook to use the context
export const useAppData = (): AppDataContextType => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};

// Helper hooks for specific data
export const useCompetitions = () => {
  const { competitions, loading, error } = useAppData();
  return { competitions, loading, error };
};


export const useAppUser = () => {
  const { user, loading, error } = useAppData();
  return { user, loading, error };
};