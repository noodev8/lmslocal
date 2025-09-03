import axios from 'axios';
import { withCache, apiCache } from './cache';

// Dynamic API URL that works for development, mobile testing, and production
const getApiBaseUrl = () => {
  // Production: Use environment variable if available
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window === 'undefined') {
    // Server-side rendering - use localhost for development
    return 'http://localhost:3015';
  }

  // Client-side development - use the same host as the frontend but with backend port
  // This supports both localhost and IP address testing on mobile
  const hostname = window.location.hostname;
  return `http://${hostname}:3015`;
};

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to set baseURL and add JWT token
api.interceptors.request.use(
  (config) => {
    // Set baseURL dynamically on each request to avoid hydration issues
    if (!config.baseURL) {
      config.baseURL = getApiBaseUrl();
    }
    
    // Only access localStorage on client-side to avoid hydration issues
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('jwt_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiration AND detailed error logging
api.interceptors.response.use(
  (response) => {
    // Log successful requests with rate limit info
    const remaining = response.headers['ratelimit-remaining'];
    const limit = response.headers['ratelimit-limit'];
    const reset = response.headers['ratelimit-reset'];
    
    if (remaining && limit) {
      const resetTime = reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : 'unknown';
      console.log(`✅ API Success: ${remaining}/${limit} requests remaining (resets at ${resetTime})`);
    } else {
      console.log(`✅ API Success: No rate limit headers found`);
    }
    
    return response;
  },
  (error) => {
    // Detailed error logging for diagnosis
    console.group('🚨 API ERROR DETAILS');
    console.log('Status Code:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Error Code:', error.code);
    console.log('Error Message:', error.message);
    console.log('URL:', error.config?.url);
    console.log('Method:', error.config?.method?.toUpperCase());
    console.log('Response Data:', error.response?.data);
    
    // Rate limit specific info
    const rateLimitHeaders = {
      limit: error.response?.headers['ratelimit-limit'],
      remaining: error.response?.headers['ratelimit-remaining'],
      reset: error.response?.headers['ratelimit-reset']
    };
    console.log('Rate Limit Headers:', rateLimitHeaders);
    
    if (error.response?.status === 429) {
      console.log('🚫 RATE LIMIT HIT - This is a proper 429 response');
    } else if (!error.response) {
      console.log('💥 NETWORK FAILURE - Server likely overloaded/crashed');
    }
    console.groupEnd();
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      // Only access localStorage on client-side to avoid hydration issues
      if (typeof window !== 'undefined') {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        // Clear cache when auth expires since cached data is no longer valid
        apiCache.clear();
        window.dispatchEvent(new CustomEvent('auth-expired'));
      }
    }
    
    return Promise.reject(error);
  }
);

export interface ApiResponse<T = unknown> {
  return_code: string;
  data?: T;
  message?: string;
  [key: string]: unknown;
}

// User interfaces
export interface User {
  id: number;
  email: string;
  display_name: string;
  name?: string;
  is_managed?: boolean;
}

// Competition interfaces  
export interface Competition {
  id: number;
  name: string;
  description?: string;
  access_code?: string;
  slug?: string;
  is_organiser: boolean;
  organiser_id: number;
  player_count?: number;
  current_round?: number;
  status: 'LOCKED' | 'UNLOCKED' | 'SETUP' | 'COMPLETE';
  team_list_id?: number;
}

// Round interfaces
export interface Round {
  id: number;
  round_number: number;
  lock_time: string;
  status: string;
  created_at?: string;
  fixture_count?: number;
}

// Player interfaces
export interface Player {
  id: number;
  display_name: string;
  email?: string;
  is_managed?: boolean;
  joined_competition?: boolean;
  lives_remaining?: number;
  status?: string;
  picks_made?: number;
  // Payment and join tracking fields
  paid: boolean;
  paid_amount?: number;
  paid_date?: string;
  joined_at: string;
}

// Fixture interfaces
export interface Fixture {
  id: number;
  home_team: string;
  away_team: string;
  home_team_short: string;
  away_team_short: string;
  kickoff_time: string;
  result?: 'home_win' | 'away_win' | 'draw';
}

// Team interfaces
export interface Team {
  id: number;
  name: string;
  short_name: string;
  is_active?: boolean;
  team_list_id?: number;
}

export interface TeamList {
  id: number;
  name: string;
  description?: string;
}

// Generic response types
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EmptyResponse {}
export interface MessageResponse {
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  display_name?: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface CreateCompetitionRequest {
  name: string;
  description?: string;
  access_code?: string;
  slug?: string;
  team_list_id: number;
  lives_per_player: number;
  no_team_twice: boolean;
  organiser_joins_as_player: boolean;
}

// Auth API calls
export const authApi = {
  login: (data: LoginRequest) => api.post<ApiResponse<{ token: string; user: User }>>('/login', data),
  register: (data: RegisterRequest) => api.post<ApiResponse<{ token: string; user: User }>>('/register', data),
  forgotPassword: (email: string) => api.post<ApiResponse<MessageResponse>>('/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post<ApiResponse<MessageResponse>>('/reset-password', { token, password }),
  verifyEmail: (token: string) => api.post<ApiResponse<MessageResponse>>('/verify-email', { token }),
  resendVerification: (email: string) => api.post<ApiResponse<MessageResponse>>('/resend-verification', { email }),
};

// Player auth API calls (magic link system)
export const playerApi = {
  login: (email: string, competition_slug?: string) => api.post<ApiResponse<MessageResponse>>('/player-login', { email, competition_slug }),
  joinBySlug: (slug: string) => api.post<ApiResponse<{ competition: Competition }>>('/join-competition-by-slug', { slug }),
  registerAndJoin: (name: string, email: string, access_code: string) => api.post<ApiResponse<{ token: string; user: User; competition: Competition }>>('/register-and-join-competition', { name, email, access_code }),
};

// Competition API calls
export const competitionApi = {
  create: (data: CreateCompetitionRequest) => api.post<ApiResponse<{ competition_id: string }>>('/create-competition', data),
  getMyCompetitions: () => withCache(
    'my-competitions',
    1 * 24 * 60 * 60 * 1000, // 1 day cache - competitions change infrequently
    () => api.post<ApiResponse<{ competitions: Competition[] }>>('/mycompetitions', {})
  ),
  getStatus: (competition_id: number) => withCache(
    `competition-status-${competition_id}`,
    30 * 60 * 1000, // 30 minutes cache - status rarely changes during admin work
    () => api.post<ApiResponse<{ current_round: Round | null; fixture_count: number; should_route_to_results: boolean }>>('/get-competition-status', { competition_id })
  ),
  getPlayers: (competition_id: number) => withCache(
    `competition-players-${competition_id}`,
    1 * 60 * 60 * 1000, // 1 hour cache - player data rarely changes during admin sessions
    () => api.post<ApiResponse<{ competition: Competition; players: Player[] }>>('/get-competition-players', { competition_id })
  ),
  removePlayer: (competition_id: number, player_id: number) => api.post<ApiResponse<{ removed_data: Player }>>('/remove-player', { competition_id, player_id }),
  getPickStatistics: (competition_id: number) => withCache(
    `pick-statistics-${competition_id}`,
    1 * 60 * 60 * 1000, // 1 hour cache - pick stats less critical for admin work
    () => api.post<ApiResponse<{ 
      current_round: { round_id: number; round_number: number } | null; 
      players_with_picks: number; 
      total_active_players: number; 
      pick_percentage: number 
    }>>('/get-pick-statistics', { competition_id })
  ),
};

// Round API calls
export const roundApi = {
  create: (competition_id: string, lock_time: string) => 
    api.post<ApiResponse<{ round_id: string }>>('/create-round', { competition_id: parseInt(competition_id), lock_time }),
  getRounds: (competition_id: number) => withCache(
    `rounds-${competition_id}`,
    5 * 60 * 1000, // 5 minutes cache - rounds change when admin creates new rounds
    () => api.post<ApiResponse<{ rounds: Round[] }>>('/get-rounds', { competition_id })
  ),
  update: (round_id: string, lock_time: string) => api.post<ApiResponse<MessageResponse>>('/update-round', { round_id: parseInt(round_id), lock_time }),
  getPlayerCurrentRound: (competition_id: string) => api.post<ApiResponse<{ round: Round }>>('/get-player-current-round', { competition_id }),
};

// Fixture API calls
export const fixtureApi = {
  addBulk: (round_id: string, fixtures: { home_team: string; away_team: string; kickoff_time: string }[]) => 
    api.post<ApiResponse<MessageResponse>>('/add-fixtures-bulk', { round_id: parseInt(round_id), fixtures }),
  get: (round_id: string) => withCache(
    `fixtures-${round_id}`,
    5 * 60 * 1000, // 5 minutes cache - fixtures change when admin adds/modifies fixtures
    () => api.post<ApiResponse<{ fixtures: Fixture[] }>>('/get-fixtures', { round_id: parseInt(round_id) })
  ),
  setResult: (fixture_id: number, result: 'home_win' | 'away_win' | 'draw') =>
    api.post<ApiResponse<MessageResponse>>('/set-fixture-result', { fixture_id, result }),
  getCalculated: (round_id: number) => withCache(
    `calculated-fixtures-${round_id}`,
    2 * 60 * 1000, // 2 minutes cache - calculated status changes as results are processed
    () => api.post<ApiResponse<{ calculated_fixture_ids: number[] }>>('/get-calculated-fixtures', { round_id })
  ),
  getPickCounts: (round_id: number) => api.post<ApiResponse<{ pick_counts: Record<string, number> }>>('/get-fixture-pick-count', { round_id }),
  getRoundHistory: (round_id: number) => api.post<ApiResponse<{ round_data: {
    round_number: number;
    fixtures: Array<{
      id: number;
      home_team: string;
      away_team: string;
      home_team_short: string;
      away_team_short: string;
      result?: string;
    }>;
    player_pick?: string;
    player_outcome?: string;
    pick_counts: Record<string, number>;
  } }>>('/get-round-history', { round_id }),
};

// Team API calls
export const teamApi = {
  getTeams: () => withCache(
    'teams',
    1 * 24 * 60 * 60 * 1000, // 1 day cache - team rosters change seasonally
    () => api.post<ApiResponse<{ teams: Team[] }>>('/get-teams', {})
  ),
  getTeamLists: () => withCache(
    'team-lists',
    1 * 60 * 60 * 1000, // 1 hour cache - team lists for competitions, may be edited
    () => api.post<ApiResponse<{ team_lists: TeamList[] }>>('/team-lists', {})
  ),
};

// Player actions
export const playerActionApi = {
  setPick: (fixture_id: number, team: string) => api.post<ApiResponse<MessageResponse>>('/set-pick', { fixture_id, team }),
  unselectPick: (round_id: number) => api.post<ApiResponse<{ warning?: string }>>('/unselect-pick', { round_id }),
  getCurrentPick: (round_id: number) => api.post<ApiResponse<{ pick?: { team: string, fixture_id: number } }>>('/get-current-pick', { round_id }),
  calculateResults: (round_id: number) => api.post<ApiResponse<MessageResponse>>('/calculate-results', { round_id: parseInt(round_id.toString()) }),
};

// Offline player management
export const offlinePlayerApi = {
  addOfflinePlayer: (competition_id: number, display_name: string, email?: string) => api.post<ApiResponse<{
    player: {
      id: number;
      display_name: string;
      email?: string;
      is_managed: boolean;
      joined_competition: boolean;
    };
  }>>('/add-offline-player', { competition_id, display_name, email }),
};

// Admin actions
export const adminApi = {
  setPlayerPick: (competition_id: number, user_id: number, team: string) => api.post<ApiResponse<{
    pick: {
      id: number;
      user_id: number;
      team: string;
      player_name: string;
      round_number: number;
    }
  }>>('/admin-set-pick', { competition_id, user_id, team }),
  updatePaymentStatus: (competition_id: number, user_id: number, paid: boolean, paid_amount?: number, paid_date?: string) => api.post<ApiResponse<{
    payment_status: {
      user_id: number;
      player_name: string;
      paid: boolean;
      paid_amount?: number;
      paid_date?: string;
    }
  }>>('/update-payment-status', { competition_id, user_id, paid, paid_amount, paid_date }),
};

// User profile
export const userApi = {
  updateProfile: (updates: Partial<User>) => api.post<ApiResponse<{ user: User }>>('/update-profile', updates),
  changePassword: (current_password: string, new_password: string) => api.post<ApiResponse<MessageResponse>>('/change-password', { current_password, new_password }),
  deleteAccount: (confirmation: string) => api.post<ApiResponse<MessageResponse>>('/delete-account', { confirmation }),
  getPlayerDashboard: () => withCache(
    'player-dashboard',
    5 * 60 * 1000, // 5 minutes cache - player view, different usage pattern
    () => api.post<ApiResponse<{ competitions: Competition[] }>>('/player-dashboard', {})
  ),
  getAllowedTeams: (competition_id: number, user_id?: number) => withCache(
    `allowed-teams-${competition_id}-${user_id || 'current'}`,
    1 * 60 * 60 * 1000, // 1 hour cache - allowed teams change less frequently
    () => api.post<ApiResponse<{ 
      allowed_teams: Team[];
      teams_reset: boolean;
      reset_message: string | null;
    }>>('/get-allowed-teams', { competition_id, ...(user_id && { user_id }) })
  ),
  checkUserType: () => withCache(
    'user-type',
    1 * 24 * 60 * 60 * 1000, // 1 day cache - user permissions rarely change mid-session
    () => api.post<ApiResponse<{ user_type: string; suggested_route: string; organized_count: number; participating_count: number; has_organized: boolean; has_participated: boolean }>>('/check-user-type', {})
  ),
  getCompetitionStandings: (competition_id: number) => withCache(
    `competition-standings-${competition_id}`,
    1 * 60 * 60 * 1000, // 1 hour cache - standings rarely needed during typical admin work
    () => api.post<ApiResponse<{ competition: Competition; players: Player[] }>>('/get-competition-standings', { competition_id })
  ),
  joinCompetitionByCode: (competition_code: string) => api.post<ApiResponse<{ competition: { id: number; name: string } }>>('/join-competition-by-code', { competition_code }),
};

// Cache utilities
export const cacheUtils = {
  // Clear competition-related cache when competitions change
  invalidateCompetitions: () => {
    apiCache.delete('my-competitions');
  },
  
  // Clear all cache entries
  clearAll: () => {
    apiCache.clear();
  },
  
  // Get cache diagnostics
  getStats: () => {
    return apiCache.getStats();
  }
};

export default api;