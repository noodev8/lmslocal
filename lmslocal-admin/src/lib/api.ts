/*
=======================================================================================================================================
Admin API Client
=======================================================================================================================================
Purpose: Axios client for the /admin/* namespace on the LMSLocal Express server.

Separate from the player app's client on purpose. The admin token lives under its own
localStorage key so that having the admin tool open in one tab and the player app in another
never lets the two sessions overwrite each other.
=======================================================================================================================================
*/

import axios from 'axios';

// Where the admin token is kept. Distinct from the player app's 'jwt_token'.
const TOKEN_KEY = 'admin_jwt_token';
const ADMIN_KEY = 'admin_user';

const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return 'http://localhost:3015';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
});

// Attach the admin token to every outgoing request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/*
The server always answers HTTP 200 and puts the real status in return_code, so an expired
session arrives as a successful response. Catch it here rather than in every page.
*/
api.interceptors.response.use((response) => {
  const code = response.data?.return_code;
  if (code === 'UNAUTHORIZED' || code === 'TOKEN_EXPIRED') {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      clearSession();
      window.location.href = '/login?expired=1';
    }
  }
  return response;
});

// ======================================================================================
// Types
// ======================================================================================

export interface AdminUser {
  id: number;
  email: string;
  display_name: string;
}

export interface AdminStats {
  competitions: {
    total: number;
    setup: number;
    active: number;
    complete: number;
    inactive: number;
  };
  players: {
    total_memberships: number;
    unique_players: number;
    still_in: number;
    eliminated: number;
  };
  users: {
    total: number;
    verified: number;
    new_last_30_days: number;
  };
  generated_at: string;
}

interface ApiResponse {
  return_code: string;
  message?: string;
}

export interface LoginResponse extends ApiResponse {
  admin?: AdminUser;
  token?: string;
  expires_at?: string;
}

export type StatsResponse = ApiResponse & Partial<AdminStats>;

export interface AdminCompetition {
  id: number;
  name: string;
  status: string;
  organiser_email: string | null;
  player_count: number;
  created_at: string;
  last_activity: string;
}

export type CompetitionsResponse = ApiResponse & {
  competitions?: AdminCompetition[];
  generated_at?: string;
};

// ======================================================================================
// Session helpers
// ======================================================================================

export const saveSession = (token: string, admin: AdminUser): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
};

export const clearSession = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
};

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const getAdmin = (): AdminUser | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    // Corrupt entry - treat as signed out rather than crashing the page
    return null;
  }
};

// ======================================================================================
// API calls
// ======================================================================================

export const adminApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/admin/admin-login', { email, password });
    return response.data;
  },

  getStats: async (): Promise<StatsResponse> => {
    const response = await api.get<StatsResponse>('/admin/get-admin-stats');
    return response.data;
  },

  getCompetitions: async (status?: string): Promise<CompetitionsResponse> => {
    const response = await api.get<CompetitionsResponse>('/admin/get-admin-competitions', {
      params: status ? { status } : undefined,
    });
    return response.data;
  },
};

export default api;
