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
    return response;
  },
  (error) => {
    // Handle authentication errors
    if (error.response?.status === 401) {
      // Only access localStorage on client-side to avoid hydration issues
      if (typeof window !== 'undefined') {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        
        // Clear all cache when auth expires - simple and safe
        apiCache.clear();
        
        window.dispatchEvent(new CustomEvent('auth-expired'));
      }
    }
    
    return Promise.reject(error);
  }
);


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
  invite_code?: string;
  access_code?: string;
  slug?: string;
  venue_name?: string;
  is_organiser: boolean;
  is_participant?: boolean;
  organiser_id?: number;
  player_count: number;
  total_players?: number;
  current_round: number;
  current_round_lock_time?: string;
  total_rounds?: number;
  picks_made?: number;
  picks_required?: number;
  pick_completion_percentage?: number;
  needs_pick?: boolean;
  current_pick?: {
    team: string;
    team_full_name: string;
    fixture: string;
  };
  lives_remaining?: number;
  user_status: string | null;
  joined_at?: string;
  team_list_name?: string;
  created_at?: string;
  is_complete?: boolean;
  winner?: {
    display_name: string;
    email?: string;
    joined_at?: string;
  };
  history?: Array<{
    round_number: number;
    pick_team: string;
    pick_team_full_name?: string;
    pick_result: string;
    fixture?: string;
  }>;
  status?: 'LOCKED' | 'UNLOCKED' | 'SETUP' | 'COMPLETE';
  team_list_id?: number;
  lives_per_player?: number;
  no_team_twice?: boolean;
}

// Round interfaces
export interface Round {
  id: number;
  round_number: number;
  lock_time: string;
  is_locked?: boolean;
  fixture_count: number;
  completed_fixtures?: number;
  created_at?: string;
  status?: string;
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
  // Visibility tracking
  hidden?: boolean;
  // Additional fields for standings/detailed views
  current_pick?: unknown;
  history?: unknown[];
}

// Fixture interfaces
export interface Fixture {
  id: number;
  home_team: string;
  away_team: string;
  home_team_short: string;
  away_team_short: string;
  kickoff_time: string;
  result?: 'home_win' | 'away_win' | 'draw' | string | null;
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

// Marketing interfaces
export interface MarketingPost {
  id: number;
  title: string;
  description?: string;
  image_url?: string;
  display_priority: number;
  is_active?: boolean;
  view_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface MarketingDisplay {
  has_marketing_content: boolean;
  venue_name?: string;
  posts: MarketingPost[];
}

export interface CreateMarketingPostRequest {
  competition_id: number;
  title: string;
  description?: string;
  image_url?: string;
  is_active?: boolean;
  display_priority?: number;
}

export interface UpdateMarketingPostRequest {
  post_id: number;
  title?: string;
  description?: string;
  image_url?: string;
  is_active?: boolean;
  display_priority?: number;
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
  acceptTerms: boolean;
}

export interface CreateCompetitionRequest {
  name: string;
  description?: string;
  venue_name?: string;
  access_code?: string;
  slug?: string;
  team_list_id: number;
  lives_per_player: number;
  no_team_twice: boolean;
  organiser_joins_as_player: boolean;
}

export interface UpdateCompetitionRequest {
  competition_id: number;
  name?: string;
  description?: string;
  venue_name?: string;
  lives_per_player?: number;
  no_team_twice?: boolean;
}

export interface UpdateCompetitionResponse {
  competition: {
    id: number;
    name: string;
    description?: string;
    lives_per_player: number;
    no_team_twice: boolean;
    has_started: boolean;
    updated_at: string;
  };
}

export interface ResetCompetitionRequest {
  competition_id: number;
}

export interface ResetCompetitionResponse {
  competition: {
    id: number;
    name: string;
    status: string;
    invite_code: string;
    reset_at: string;
    players_affected: number;
  };
}

export interface DeleteCompetitionRequest {
  competition_id: number;
}

export interface DeleteCompetitionResponse {
  deletion_summary: {
    competition_id: number;
    competition_name: string;
    players_removed: number;
    rounds_deleted: number;
    fixtures_deleted: number;
    picks_deleted: number;
    progress_records_deleted: number;
    allowed_teams_deleted: number;
    deleted_at: string;
  };
}


// Auth API calls
export const authApi = {
  login: (data: LoginRequest) => api.post<{ return_code: string; token: string; user: User }>('/login', data),
  register: (data: RegisterRequest) => api.post<{ return_code: string; token: string; user: User }>('/register', data),
  forgotPassword: (email: string) => api.post<{ return_code: string; message: string }>('/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post<{ return_code: string; message: string }>('/reset-password', { token, password }),
  verifyEmail: (token: string) => api.post<{ return_code: string; message: string }>('/verify-email', { token }),
  resendVerification: (email: string) => api.post<{ return_code: string; message: string }>('/resend-verification', { email }),
};

// Player auth API calls (magic link system)
export const playerApi = {
  login: (email: string, competition_slug?: string) => api.post<{ return_code: string; message: string }>('/player-login', { email, competition_slug }),
  joinBySlug: (slug: string) => api.post<{ return_code: string; competition: Competition }>('/join-competition-by-slug', { slug }),
  registerAndJoin: (name: string, email: string, access_code: string) => api.post<{ return_code: string; token: string; user: User; competition: Competition }>('/register-and-join-competition', { name, email, access_code }),
};

// Helper to get current user ID for cache keys
const getUserId = (): string => {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      return user.id?.toString() || 'unknown';
    }
  } catch (error) {
    console.warn('Failed to get user ID for cache key:', error);
  }
  return 'anonymous';
};

// Competition API calls
export const competitionApi = {
  create: (data: CreateCompetitionRequest) => api.post<{ return_code: string; message?: string; competition?: Competition; competition_id?: string }>('/create-competition', data),
  getStatus: (competition_id: number) => withCache(
    `competition-status-${competition_id}`,
    30 * 60 * 1000, // 30 minutes cache - status rarely changes during admin work
    () => api.post<{ return_code: string; current_round: Round | null; fixture_count: number; should_route_to_results: boolean }>('/get-competition-status', { competition_id })
  ),
  getPlayers: (competition_id: number) => withCache(
    `competition-players-${competition_id}`,
    1 * 60 * 60 * 1000, // 1 hour cache - player data rarely changes during admin sessions
    () => api.post<{ return_code: string; message?: string; competition?: Competition; players?: Player[] }>('/get-competition-players', { competition_id })
  ),
  removePlayer: (competition_id: number, player_id: number) => api.post<{ return_code: string; message?: string; removed_data?: Player }>('/remove-player', { competition_id, player_id }),
  getPickStatistics: (competition_id: number) => withCache(
    `pick-statistics-${competition_id}`,
    1 * 60 * 60 * 1000, // 1 hour cache - pick stats less critical for admin work
    () => api.post<{ 
      return_code: string;
      current_round: { round_id: number; round_number: number } | null; 
      players_with_picks: number; 
      total_active_players: number; 
      pick_percentage: number 
    }>('/get-pick-statistics', { competition_id })
  ),
  update: (data: UpdateCompetitionRequest) => api.post<UpdateCompetitionResponse & { return_code: string; message?: string }>('/update-competition', data),
  reset: (data: ResetCompetitionRequest) => api.post<ResetCompetitionResponse & { return_code: string; message?: string }>('/reset-competition', data),
  delete: (data: DeleteCompetitionRequest) => api.post<DeleteCompetitionResponse & { return_code: string; message?: string }>('/delete-competition', data),
  hide: (competition_id: number) => api.post<{ return_code: string; message: string }>('/hide-competition', { competition_id }),
  unhidePlayer: (competition_id: number, player_id: number) => api.post<{ return_code: string; message: string }>('/unhide-player', { competition_id, player_id }),
};

// Round API calls
export const roundApi = {
  create: (competition_id: string, lock_time: string) => 
    api.post<{ return_code: string; message?: string; round?: Round }>('/create-round', { competition_id: parseInt(competition_id), lock_time }),
  getRounds: (competition_id: number) => withCache(
    `rounds-${competition_id}`,
    30 * 60 * 1000, // 30 minutes cache - new round fixtures happen weekly
    () => api.post<{ return_code: string; message?: string; rounds?: Round[] }>('/get-rounds', { competition_id })
  ),
  update: (round_id: string, lock_time: string) => api.post<{ return_code: string; message: string }>('/update-round', { round_id: parseInt(round_id), lock_time }),
  getPlayerCurrentRound: (competition_id: string) => api.post<{ return_code: string; round: Round }>('/get-player-current-round', { competition_id }),
};

// Fixture API calls
export const fixtureApi = {
  addBulk: (round_id: string, fixtures: { home_team: string; away_team: string; kickoff_time: string }[]) => 
    api.post<{ return_code: string; message: string }>('/add-fixtures-bulk', { round_id: parseInt(round_id), fixtures }),
  get: (round_id: string) => withCache(
    `fixtures-${round_id}`,
    30 * 60 * 1000, // 30 minutes cache - new round fixtures happen weekly
    () => api.post<{ return_code: string; message?: string; fixtures?: Fixture[]; round_info?: { round_number: number; lock_time: string | null; is_locked: boolean; all_processed: boolean } }>('/get-fixtures', { round_id: parseInt(round_id) })
  ),
  setResult: (fixture_id: number, result: 'home_win' | 'away_win' | 'draw') =>
    api.post<{ return_code: string; message: string }>('/set-fixture-result', { fixture_id, result }),
  getCalculated: (round_id: number) => withCache(
    `calculated-fixtures-${round_id}`,
    30 * 60 * 1000, // 30 minutes cache - new round fixtures happen weekly
    () => api.post<{ return_code: string; calculated_fixture_ids: number[] }>('/get-calculated-fixtures', { round_id })
  ),
  getPickCounts: (round_id: number) => api.post<{ return_code: string; pick_counts: Record<string, number> }>('/get-fixture-pick-count', { round_id }),
  getRoundHistory: (round_id: number) => api.post<{ return_code: string; round_data: {
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
  } }>('/get-round-history', { round_id }),
  reset: (round_id: number) => api.post<{
    return_code: string;
    message?: string;
    reset_summary?: {
      round_number: number;
      fixtures_removed: number;
      picks_removed: number;
      teams_restored: number;
      players_affected: number;
    }
  }>('/reset-fixtures', { round_id }),
  submitResults: (competition_id: number, results: Array<{ fixture_id: number; result: string }>) =>
    api.post<{
      return_code: string;
      message: string;
      fixtures_updated?: number;
      fixtures_processed?: number;
      competition_status?: string;
      winner_status?: string;
      players_affected?: number;
      round_number?: number;
      active_players?: number;
      winner_name?: string;
      winner_id?: number;
      total_rounds?: number;
      round_stats?: {
        round_number: number;
        eliminated_this_round: number;
        survivors: number;
        total_eliminated: number;
        total_players: number;
      };
    }>('/submit-results', { competition_id, results }),
};

// Team API calls
export const teamApi = {
  getTeams: () => withCache(
    'teams',
    1 * 24 * 60 * 60 * 1000, // 1 day cache - team rosters change seasonally
    () => api.post<{ return_code: string; teams: Team[] }>('/get-teams', {})
  ),
  getTeamLists: () => withCache(
    'team-lists',
    1 * 60 * 60 * 1000, // 1 hour cache - team lists for competitions, may be edited
    () => api.post<{ return_code: string; team_lists: TeamList[]; summary: { total_lists: number; total_teams: number } }>('/team-lists', {})
  ),
};

// Player actions
export const playerActionApi = {
  setPick: (fixture_id: number, team: string) => api.post<{ return_code: string; message: string }>('/set-pick', { fixture_id, team }),
  unselectPick: (round_id: number) => api.post<{ return_code: string; message?: string; warning?: string }>('/unselect-pick', { round_id }),
  getCurrentPick: (round_id: number) => api.post<{ return_code: string; pick?: { team: string, fixture_id: number } }>('/get-current-pick', { round_id }),
  calculateResults: (round_id: number) => api.post<{ return_code: string; message: string }>('/calculate-results', { round_id: parseInt(round_id.toString()) }),
};

// Offline player management
export const offlinePlayerApi = {
  addOfflinePlayer: (competition_id: number, display_name: string, email?: string) => api.post<{
    return_code: string;
    message?: string;
    player?: {
      id: number;
      display_name: string;
      email?: string;
      is_managed: boolean;
      joined_competition: boolean;
    };
  }>('/add-offline-player', { competition_id, display_name, email }),
};

// Admin actions
export const adminApi = {
  setPlayerPick: (competition_id: number, user_id: number, team: string) => api.post<{
    return_code: string;
    pick: {
      id?: number;
      user_id: number;
      team: string | null;
      player_name: string;
      round_number: number;
      was_removed?: boolean;
      set_by_admin?: boolean;
    };
    message?: string;
  }>('/admin-set-pick', { competition_id, user_id, team }),
  updatePaymentStatus: (competition_id: number, user_id: number, paid: boolean, paid_amount?: number, paid_date?: string) => api.post<{
    return_code: string;
    message?: string;
    payment_status?: {
      user_id: number;
      player_name: string;
      paid: boolean;
      paid_amount?: number;
      paid_date?: string;
    }
  }>('/update-payment-status', { competition_id, user_id, paid, paid_amount, paid_date }),

  // Lives management - allows admins to add/subtract/set player lives with audit logging
  updatePlayerLives: (competition_id: number, player_id: number, operation: 'add' | 'subtract' | 'set', amount: number, reason?: string) => api.post<{
    return_code: string;
    message?: string;
    lives_remaining?: number;        // New lives count after operation
    previous_lives?: number;         // Lives count before operation
    player_name?: string;           // Player display name
    operation_performed?: string;   // Operation that was performed
  }>('/update-player-lives', { competition_id, player_id, operation, amount, reason }),

  // Player status management - allows admins to set players as active or out
  updatePlayerStatus: (competition_id: number, player_id: number, status: 'active' | 'out', reason?: string) => api.post<{
    return_code: string;
    message?: string;
    player_name?: string;           // Player display name
    old_status?: string;            // Previous status
    new_status?: string;            // New status
  }>('/update-player-status', { competition_id, player_id, status, reason }),
};

// User profile
export const userApi = {
  updateProfile: (updates: Partial<User>) => api.post<{ return_code: string; message?: string; user?: User }>('/update-profile', updates),
  changePassword: (current_password: string, new_password: string) => api.post<{ return_code: string; message: string }>('/change-password', { current_password, new_password }),
  deleteAccount: (confirmation: string) => api.post<{ return_code: string; message: string }>('/delete-account', { confirmation }),
  getUserDashboard: () => {
    const userId = getUserId();
    return withCache(
      `user-dashboard-${userId}`, // User-specific cache key
      5 * 60 * 1000, // 5 minutes cache - optimal for dashboard data
      () => api.post<{
        return_code: string;
        message?: string;
        competitions?: Competition[];
        latest_round_stats?: {
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
        };
      }>('/get-user-dashboard', {})
    );
  },
  getAllowedTeams: (competition_id: number, user_id?: number) => withCache(
    `allowed-teams-${competition_id}-${user_id || 'current'}`,
    1 * 60 * 60 * 1000, // 1 hour cache - allowed teams change less frequently
    () => api.post<{ 
      return_code: string;
      allowed_teams: Team[];
      teams_reset: boolean;
      reset_message: string | null;
    }>('/get-allowed-teams', { competition_id, ...(user_id && { user_id }) })
  ),
  checkUserType: () => withCache(
    'user-type',
    1 * 24 * 60 * 60 * 1000, // 1 day cache - user permissions rarely change mid-session
    () => api.post<{ return_code: string; user_type: string; suggested_route: string; organized_count: number; participating_count: number; has_organized: boolean; has_participated: boolean }>('/check-user-type', {})
  ),
  getCompetitionStandings: (competition_id: number, show_full_user_history = false) => withCache(
    `competition-standings-${competition_id}-${show_full_user_history ? 'full' : 'recent'}`,
    1 * 60 * 60 * 1000, // 1 hour cache - standings rarely needed during typical admin work
    () => api.post<{ return_code: string; message?: string; competition?: Competition; players?: Player[] }>('/get-competition-standings', { competition_id, show_full_user_history })
  ),
  joinCompetitionByCode: (competition_code: string) => api.post<{ return_code: string; message?: string; competition?: { id: number; name: string } }>('/join-competition-by-code', { competition_code }),
};

// Marketing API calls
export const marketingApi = {
  getCompetitionDisplay: (competition_id: number) => withCache(
    `marketing-display-${competition_id}`,
    1 * 60 * 60 * 1000, // 1 hour cache - marketing content changes less frequently
    () => api.post<MarketingDisplay & { return_code: string; message?: string }>('/get-competition-marketing-display', { competition_id })
  ),

  // Organizer management functions
  getMarketingPosts: (competition_id: number) => api.post<{
    return_code: string;
    message?: string;
    posts?: MarketingPost[];
    active_post_count?: number;
    max_posts_allowed?: number;
  }>('/get-marketing-posts', { competition_id }),

  createMarketingPost: (data: CreateMarketingPostRequest) => api.post<{
    return_code: string;
    message?: string;
    post?: MarketingPost;
  }>('/create-marketing-post', data),

  updateMarketingPost: (data: UpdateMarketingPostRequest) => api.post<{
    return_code: string;
    message?: string;
  }>('/update-marketing-post', data),

  deleteMarketingPost: (post_id: number) => api.post<{
    return_code: string;
    message?: string;
  }>('/delete-marketing-post', { post_id }),
};

// Cache utilities
export const cacheUtils = {
  // Clear competition-related cache when competitions change
  invalidateCompetitions: () => {
    const userId = getUserId();
    apiCache.delete(`user-dashboard-${userId}`);
  },
  
  // Clear specific cache key
  invalidateKey: (key: string) => {
    apiCache.delete(key);
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