'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { competitionApi, teamApi } from '@/lib/api';
import { Competition, Team, User } from '@/lib/api';
import '@/lib/cache';

interface AppDataContextType {
  // Data
  competitions: Competition[] | null;
  teams: Team[] | null;
  user: User | null;
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshData: () => void;
  
  // Metadata
  lastUpdated: number | null;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

interface AppDataProviderProps {
  children: ReactNode;
}

export const AppDataProvider: React.FC<AppDataProviderProps> = ({ children }) => {
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [teams, setTeams] = useState<Team[] | null>(null);
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
      
      // Load app-level data using our cached API calls
      const [competitionsData, teamsData] = await Promise.all([
        competitionApi.getMyCompetitions(),
        teamApi.getTeams()
      ]);
      
      // Handle competitions response
      if (competitionsData.data.return_code === 'SUCCESS') {
        setCompetitions((competitionsData.data.competitions as Competition[]) || []);
      } else {
        console.error('Failed to load competitions:', competitionsData.data.message);
        setCompetitions([]);
      }
      
      // Handle teams response
      if (teamsData.data.return_code === 'SUCCESS') {
        setTeams((teamsData.data.teams as Team[]) || []);
      } else {
        console.error('Failed to load teams:', teamsData.data.message);
        setTeams([]);
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

  // Load data on mount
  useEffect(() => {
    loadAppData();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setCompetitions(null);
      setTeams(null);
      setLoading(false);
    };

    const handleAuthSuccess = () => {
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
    teams,
    user,
    loading,
    error,
    refreshData,
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

export const useTeams = () => {
  const { teams, loading, error } = useAppData();
  return { teams, loading, error };
};

export const useAppUser = () => {
  const { user, loading, error } = useAppData();
  return { user, loading, error };
};