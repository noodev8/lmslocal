'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { userApi } from '@/lib/api';
import { Competition, User } from '@/lib/api';
import '@/lib/cache';

interface AppDataContextType {
  // Data
  competitions: Competition[] | null;
  user: User | null;
  latestRoundStats: {
    competition_id: number;
    competition_name: string;
    round_number: number;
    eliminated_this_round: number;
    survivors: number;
    total_eliminated: number;
    total_players: number;
    user_outcome: string | null;
    user_status: string;
    user_picked_team: string | null;
  } | null;

  // Loading states
  loading: boolean;
  error: string | null;

  // Actions
  refreshData: () => void;
  refreshCompetitions: (bypassCache?: boolean) => Promise<void>;
  forceRefresh: () => Promise<void>;
  updateCompetition: (competitionId: number, updates: Partial<Competition>) => void;

  // Metadata
  lastUpdated: number | null;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

interface AppDataProviderProps {
  children: ReactNode;
}

export const AppDataProvider: React.FC<AppDataProviderProps> = ({ children }) => {
  const pathname = usePathname();
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [latestRoundStats, setLatestRoundStats] = useState<AppDataContextType['latestRoundStats']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const loadAppData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if we're in the browser first
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      // Check if user is authenticated first
      const token = localStorage.getItem('jwt_token');
      const userData = localStorage.getItem('user');

      if (!token || !userData) {
        // No authentication - set defaults and exit early
        setUser(null);
        setCompetitions([]);
        setLatestRoundStats(null);
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
        setLatestRoundStats(competitionsData.data.latest_round_stats || null);
      } else if (competitionsData.data.return_code === 'UNAUTHORIZED' ||
                 competitionsData.data.message?.includes('Invalid token') ||
                 competitionsData.data.message?.includes('user not found')) {
        // Invalid token - clear localStorage and redirect to login
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        setUser(null);
        setCompetitions([]);
        setLatestRoundStats(null);
        console.log('Invalid token detected, cleared localStorage');

        // Redirect to home page if on a protected route
        if (typeof window !== 'undefined' && window.location.pathname !== '/' && window.location.pathname !== '/login') {
          window.location.href = '/';
        }
      } else {
        console.error('Failed to load competitions:', competitionsData.data.message);
        setCompetitions([]);
      }

      setLastUpdated(Date.now());

    } catch (err) {
      console.error('Error loading app data:', err);

      // Check if it's an authentication error
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('Invalid token') ||
          errorMessage.includes('user not found') ||
          errorMessage.includes('UNAUTHORIZED')) {
        // Invalid token - clear localStorage and redirect
        if (typeof window !== 'undefined') {
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('user');

          // Redirect to home page if on a protected route
          if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
            window.location.href = '/';
          }
        }
        setUser(null);
        setCompetitions([]);
        setLatestRoundStats(null);
        setError(null);
        console.log('Invalid token detected in catch, cleared localStorage');
        return;
      }

      // For unauthenticated users, don't set error state - just set defaults
      const token = typeof window !== 'undefined' ? localStorage.getItem('jwt_token') : null;
      if (!token) {
        setUser(null);
        setCompetitions([]);
        setLatestRoundStats(null);
        setError(null); // Don't show errors for public pages
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load app data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
        setLatestRoundStats(competitionsData.data.latest_round_stats || null);
        setLastUpdated(timestamp);
        setError(null); // Clear any previous errors
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
        setLatestRoundStats(competitionsData.data.latest_round_stats || null);
        setLastUpdated(Date.now());
      } else {
        console.error('Failed to refresh competitions:', competitionsData.data.message);
      }
    } catch (err) {
      console.error('Error refreshing competitions:', err);
    }
  };

  const updateCompetition = (competitionId: number, updates: Partial<Competition>) => {
    setCompetitions(prevCompetitions => {
      if (!prevCompetitions) return prevCompetitions;

      return prevCompetitions.map(comp =>
        comp.id === competitionId
          ? { ...comp, ...updates }
          : comp
      );
    });
  };

  // Load data only when authenticated and on appropriate pages
  useEffect(() => {
    // Don't load data on public pages
    const publicPages = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/pricing', '/help', '/terms', '/privacy', '/onboarding'];
    const isPublicPage = publicPages.some(page => pathname.startsWith(page)) || pathname === '/';

    if (isPublicPage) {
      setLoading(false);
      return;
    }

    // Only load if we have authentication data
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      loadAppData();
    } else {
      setLoading(false);
    }
  }, [pathname, loadAppData]);

  // Listen for auth state changes
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setCompetitions(null);
      setLatestRoundStats(null);
      setLoading(false);
    };

    const handleAuthSuccess = async () => {
      // Clear all cache on login for fresh start
      const { cacheUtils } = await import('@/lib/cache');
      cacheUtils.clearAll();
      
      // Reload data after successful login
      loadAppData();
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    window.addEventListener('auth-success', handleAuthSuccess);

    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
      window.removeEventListener('auth-success', handleAuthSuccess);
    };
  }, [loadAppData]);

  const value: AppDataContextType = {
    competitions,
    user,
    latestRoundStats,
    loading,
    error,
    refreshData,
    refreshCompetitions,
    forceRefresh,
    updateCompetition,
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