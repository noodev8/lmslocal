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

// Credit system interfaces (PAYG model)
export interface UserCredits {
  paid_credit: number;              // Available paid credits
  total_players: number;             // Total players across all competitions
  free_players_used: number;         // Players using free tier (0-free_player_limit)
  paid_players_used: number;         // Players beyond free tier
  free_player_limit: number;         // Configurable free tier limit from backend .env
}

export interface CreditPurchase {
  pack_type: string;                 // Pack identifier (e.g., 'popular_50')
  pack_name: string;                 // Friendly pack name
  credits_purchased: number;         // Credits in pack
  paid_amount: number;               // Amount paid in GBP
  purchased_at: string;              // ISO datetime
}

export interface CreditBillingHistoryItem {
  id: number;
  pack_type: string;
  pack_name: string;
  credits_purchased: number;
  paid_amount: number;
  original_price: number | null;     // Price before discount (null if no promo)
  discount_amount: number | null;    // Discount applied (null if no promo)
  promo_code: string | null;         // Promo code used (null if none)
  stripe_session_id: string;
  purchased_at: string;
}

export interface CreditPack {
  pack_type: string;
  credits: number;
  price: number;
  name: string;
  description: string;
  badge: string | null;
  popular?: boolean;
}

// Legacy subscription interfaces (deprecated - kept for backwards compatibility)
export interface UserSubscription {
  plan: 'free' | 'club' | 'venue';
  expiry: string | null;
  player_count: number;
  player_limit: number;
  usage_percentage: number;
}

export interface PlanLimits {
  free: number;
  club: number;
  venue: number;
}

export interface BillingHistoryItem {
  id: number;
  plan_name: string;
  paid_amount: number;
  payment_date: string;
  stripe_session_id: string;
  billing_cycle: string;
}

// Competition interfaces
export interface Competition {
  id: number;
  name: string;
  description?: string;
  logo_url?: string;
  invite_code?: string;
  access_code?: string;
  slug?: string;
  venue_name?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  is_organiser: boolean;
  is_participant?: boolean;
  organiser_id?: number;
  player_count: number;
  total_players?: number;
  current_round: number;
  current_round_lock_time?: string;
  fixture_service?: boolean;
  total_rounds?: number;
  picks_made?: number;
  picks_required?: number;
  pick_completion_percentage?: number;
  needs_pick?: boolean;
  // Delegated permissions (for participants with management access)
  manage_results?: boolean;
  manage_fixtures?: boolean;
  manage_players?: boolean;
  manage_promote?: boolean;
  current_pick?: {
    team: string;
    team_full_name: string;
    fixture: string;
  };
  lives_remaining?: number;
  user_status: string | null;
  joined_at?: string;
  team_list_name?: string;
  personal_name?: string | null;
  created_at?: string;
  is_complete?: boolean;
  winner_id?: number | null;
  winner_name?: string | null;
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
  // Delegated permissions (for organisers to grant management access)
  manage_results?: boolean;
  manage_fixtures?: boolean;
  manage_players?: boolean;
  manage_promote?: boolean;
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
  logo_url?: string;
  venue_name?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  access_code?: string;
  slug?: string;
  team_list_id: number;
  lives_per_player: number;
  no_team_twice: boolean;
  organiser_joins_as_player: boolean;
  start_delay_days?: number;
}

export interface UpdateCompetitionRequest {
  competition_id: number;
  name?: string;
  description?: string;
  logo_url?: string;
  venue_name?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postcode?: string;
  phone?: string;
  email?: string;
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
  getPlayers: (competition_id: number, page: number = 1, page_size: number = 50, search?: string) => withCache(
    `competition-players-${competition_id}-page-${page}-size-${page_size}-search-${search || 'none'}`,
    1 * 60 * 60 * 1000, // 1 hour cache - player data rarely changes during admin sessions
    () => api.post<{
      return_code: string;
      message?: string;
      competition?: Competition;
      pagination?: {
        current_page: number;
        page_size: number;
        total_players: number;
        total_pages: number;
      };
      players?: Player[]
    }>('/get-competition-players', { competition_id, page, page_size, search })
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
  getUnpickedPlayers: (competition_id: number, round_id?: number) => api.post<{
    return_code: string;
    message?: string;
    round_number?: number;
    unpicked_players?: Array<{ user_id: number; display_name: string }>;
    total_unpicked?: number;
  }>('/get-unpicked-players', { competition_id, round_id }),
  update: (data: UpdateCompetitionRequest) => api.post<UpdateCompetitionResponse & { return_code: string; message?: string }>('/update-competition', data),
  reset: (data: ResetCompetitionRequest) => api.post<ResetCompetitionResponse & { return_code: string; message?: string }>('/reset-competition', data),
  delete: (data: DeleteCompetitionRequest) => api.post<DeleteCompetitionResponse & { return_code: string; message?: string }>('/delete-competition', data),
  hide: (competition_id: number) => api.post<{ return_code: string; message: string }>('/hide-competition', { competition_id }),
  unhidePlayer: (competition_id: number, player_id: number) => api.post<{ return_code: string; message: string }>('/unhide-player', { competition_id, player_id }),
  updatePersonalName: (competition_id: number, personal_name: string | null) => api.post<{ return_code: string; message?: string; personal_name?: string | null }>('/update-personal-competition-name', { competition_id, personal_name }),
};

// Round API calls
export const roundApi = {
  create: (competition_id: string, lock_time: string) => 
    api.post<{ return_code: string; message?: string; round?: Round }>('/create-round', { competition_id: parseInt(competition_id), lock_time }),
  getRounds: (competition_id: number) => withCache(
    `rounds-${competition_id}`,
    15 * 60 * 1000, // 15 minute cache - responsive to round status changes during active periods
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
    60 * 60 * 1000, // 1 hour cache - new round fixtures happen weekly
    () => api.post<{ return_code: string; message?: string; fixtures?: Fixture[]; round_info?: { round_number: number; lock_time: string | null; is_locked: boolean; all_processed: boolean } }>('/get-fixtures', { round_id: parseInt(round_id) })
  ),
  setResult: (fixture_id: number, result: 'home_win' | 'away_win' | 'draw') =>
    api.post<{ return_code: string; message: string }>('/set-fixture-result', { fixture_id, result }),
  getCalculated: (round_id: number) => withCache(
    `calculated-fixtures-${round_id}`,
    60 * 60 * 1000, // 1 hour cache - new round fixtures happen weekly
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
  getTeams: (team_list_id?: number) => withCache(
    team_list_id ? `teams-${team_list_id}` : 'teams', // Cache by team list for specificity
    1 * 24 * 60 * 60 * 1000, // 1 day cache - team rosters change seasonally
    () => api.post<{ return_code: string; teams: Team[] }>('/get-teams', team_list_id ? { team_list_id } : {})
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
  // REMOVED: calculateResults (orphaned API - never used)
};

// Offline player management
export const offlinePlayerApi = {
  addOfflinePlayer: (competition_id: number, display_name: string) => api.post<{
    return_code: string;
    message?: string;
    player?: {
      id: number;
      display_name: string;
      email?: string;
      is_managed: boolean;
      joined_competition: boolean;
    };
  }>('/add-offline-player', { competition_id, display_name }),
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
  getPlayerPick: (round_id: number, user_id: number) => api.post<{
    return_code: string;
    pick?: {
      team: string;
      team_full_name?: string;
      fixture_id: number;
      fixture?: string;
      created_at?: string;
    }
  }>('/get-current-pick', { round_id, user_id }),
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
// Email preference interfaces
export interface EmailPreferences {
  global: {
    all_emails: boolean;
    pick_reminder: boolean;
    welcome: boolean;
    results: boolean;
  };
  competition_specific: Array<{
    competition_id: number;
    competition_name: string;
    personal_name: string | null;
    all_emails: boolean;
    pick_reminder: boolean;
    results: boolean;
  }>;
}

export const userApi = {
  updateProfile: (updates: Partial<User>) => api.post<{ return_code: string; message?: string; user?: User }>('/update-profile', updates),
  changePassword: (current_password: string, new_password: string) => api.post<{ return_code: string; message: string }>('/change-password', { current_password, new_password }),
  deleteAccount: (confirmation: string) => api.post<{ return_code: string; message: string }>('/delete-account', { confirmation }),
  getEmailPreferences: (competition_id?: number) => api.post<{
    return_code: string;
    message?: string;
    preferences?: EmailPreferences
  }>('/get-email-preferences', competition_id ? { competition_id } : {}),
  updateEmailPreferencesBatch: (preferences: Array<{ competition_id: number; email_type: string | null; enabled: boolean }>) => api.post<{
    return_code: string;
    message?: string;
    updated_count?: number;
  }>('/update-email-preferences-batch', { preferences }),
  getUserDashboard: () => {
    const userId = getUserId();
    return withCache(
      `user-dashboard-${userId}`, // User-specific cache key
      15 * 60 * 1000, // 15 minute cache - responsive during active game periods
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
  getCompetitionStandings: (competition_id: number, show_full_user_history = false, page = 1, page_size = 50, filter_by_lives = 'all', search?: string) => withCache(
    `competition-standings-${competition_id}-${show_full_user_history ? 'full' : 'recent'}-page${page}-size${page_size}-filter${filter_by_lives}-search${search || 'none'}`,
    1 * 60 * 60 * 1000, // 1 hour cache - standings rarely needed during typical admin work
    () => api.post<{
      return_code: string;
      message?: string;
      competition?: Competition;
      pagination?: { current_page: number; page_size: number; total_players: number; total_pages: number };
      filter_counts?: { all: number; lives_2: number; lives_1: number; lives_0: number; out: number };
      players?: Player[];
    }>('/get-competition-standings', { competition_id, show_full_user_history, page, page_size, filter_by_lives, search })
  ),
  getStandingsSummary: (competition_id: number) => withCache(
    `standings-summary-${competition_id}`,
    1 * 60 * 60 * 1000, // 1 hour cache
    () => api.post<{
      return_code: string;
      message?: string;
      competition?: {
        id: number;
        name: string;
        current_round: number;
        status: string;
      };
      round_state?: string;
      your_position?: {
        lives: number;
        status: string;
        fixture_status: string;
        group_key: string;
        group_name: string;
      };
      groups?: Array<{
        key: string;
        name: string;
        lives: number | null;
        fixture_status: string | null;
        count: number;
        icon: string;
        winner_name?: string;
      }>;
    }>('/get-standings-summary', { competition_id })
  ),
  getStandingsGroup: (competition_id: number, group_key: string, page = 1, page_size = 20) =>
    api.post<{
      return_code: string;
      message?: string;
      group?: {
        key: string;
        name: string;
      };
      pagination?: {
        current_page: number;
        page_size: number;
        total_players: number;
        total_pages: number;
      };
      players?: Array<{
        id: number;
        display_name: string;
        lives_remaining: number;
        status: string;
        current_pick: {
          team: string;
          team_full_name: string;
          fixture: string;
          outcome: string;
        } | null;
        elimination_pick: {
          round_number: number;
          team: string;
          fixture: string;
          result: string;
        } | null;
      }>;
    }>('/get-standings-group', { competition_id, group_key, page, page_size }),
  searchPlayers: (competition_id: number, search_term: string, limit = 10) =>
    api.post<{
      return_code: string;
      message?: string;
      results?: Array<{
        id: number;
        display_name: string;
        lives_remaining: number;
        status: string;
        group_key: string;
        group_name: string;
        current_pick: {
          team: string;
          team_full_name: string;
          fixture: string;
          outcome: string;
        } | null;
        elimination_pick: {
          round_number: number;
          team: string;
          fixture: string;
          result: string;
        } | null;
      }>;
    }>('/search-players', { competition_id, search_term, limit }),
  getPlayerHistory: (competition_id: number, player_id: number) =>
    api.post<{
      return_code: string;
      message?: string;
      player?: {
        id: number;
        display_name: string;
        lives_remaining: number;
        status: string;
      };
      history?: Array<{
        round_id: number;
        round_number: number;
        pick_team: string;
        pick_team_full_name: string;
        fixture: string | null;
        fixture_result: string | null;
        pick_result: string;
        lock_time: string;
      }>;
    }>('/get-player-history', { competition_id, player_id }),
  joinCompetitionByCode: (competition_code: string) => api.post<{ return_code: string; message?: string; competition?: { id: number; name: string } }>('/join-competition-by-code', { competition_code }),

  // Credit system APIs (PAYG model)
  getUserCredits: () => {
    const userId = getUserId();
    return withCache(
      `user-credits-${userId}`, // User-specific cache key
      1 * 60 * 60 * 1000, // 1 hour cache - credit data changes when players join/credits purchased
      () => api.post<{
        return_code: string;
        message?: string;
        credits?: UserCredits;
        recent_purchases?: CreditPurchase[];
      }>('/get-user-credits', {})
    );
  },
  getBillingHistory: () => {
    const userId = getUserId();
    return withCache(
      `billing-history-${userId}`, // User-specific cache key
      1 * 60 * 60 * 1000, // 1 hour cache - invalidated after payments
      () => api.post<{
        return_code: string;
        message?: string;
        purchases?: CreditBillingHistoryItem[];
      }>('/get-billing-history', {})
    );
  },
  createCheckoutSession: (pack_type: string, promo_code?: string) =>
    api.post<{
      return_code: string;
      message?: string;
      checkout_url?: string;
      session_id?: string;
      pack_info?: {
        pack_type: string;
        credits: number;
        original_price: number;
        discount_amount: number;
        final_price: number;
      };
    }>('/create-checkout-session', { pack_type, promo_code }),
  validatePromoCode: (code: string, pack_type?: string) =>
    api.post<{
      return_code: string;
      message?: string;
      valid?: boolean;
      promo_code?: {
        code: string;
        description: string;
        discount_type: 'percentage' | 'fixed';
        discount_value: number;
      };
      pricing?: {
        starter_10?: {
          credits: number;
          original: number;
          discount: number;
          final: number;
        };
        popular_50?: {
          credits: number;
          original: number;
          discount: number;
          final: number;
        };
        value_200?: {
          credits: number;
          original: number;
          discount: number;
          final: number;
        };
      };
      expires_at?: string | null;
    }>('/validate-promo-code', { code, pack_type }),

  // Legacy subscription APIs (deprecated - kept for backwards compatibility)
  getUserSubscription: () => {
    const userId = getUserId();
    return withCache(
      `user-subscription-${userId}`, // User-specific cache key
      1 * 60 * 60 * 1000, // 1 hour cache - subscription data changes infrequently
      () => api.post<{
        return_code: string;
        message?: string;
        subscription?: UserSubscription;
        plan_limits?: PlanLimits;
      }>('/get-user-subscription', {})
    );
  },
};

// Promote/Marketing API calls
export const promoteApi = {
  getPromoteData: (competition_id: number) => withCache(
    `promote-data-${competition_id}`,
    1 * 60 * 60 * 1000, // 1 hour cache - data is a snapshot anyway, reduces DB load
    () => api.post<{
      return_code: string;
      message?: string;
      competition?: {
        id: number;
        name: string;
        status: string;
        invite_code: string;
        join_url: string;
        game_url: string;
        total_players: number;
      };
      current_round?: {
        round_number: number;
        lock_time: string | null;
        lock_time_formatted: string | null;
        is_locked: boolean;
        fixture_count: number;
        completed_fixtures: number;
        next_round_info: {
          exists: boolean;
          round_number?: number;
          has_fixtures?: boolean;
          message: string | null;
        } | null;
      } | null;
      player_stats?: {
        total_active_players: number;
        players_eliminated_this_round: number;
        pick_percentage: number;
        players_with_picks: number;
        players_without_picks: number;
      };
      top_players?: Array<{
        display_name: string;
        lives_remaining: number;
      }>;
      template_context?: {
        show_pre_launch: boolean;
        show_round_update: boolean;
        show_pick_reminder: boolean;
        show_winner: boolean;
      };
    }>('/get-promote-data', { competition_id })
  ),

  getRoundResultsBreakdown: (competition_id: number, round_number?: number) => api.post<{
    return_code: string;
    message?: string;
    round_number?: number;
    fixture_results?: Array<{
      fixture_id: number;
      home_team: string;
      away_team: string;
      home_team_short: string;
      away_team_short: string;
      result: string | null;
      outcome: 'home_win' | 'away_win' | 'draw' | null;
      kickoff_time: string;
      home_picks: number;
      away_picks: number;
      survivors: number;
      eliminated: number;
    }>;
    summary?: {
      total_fixtures: number;
      completed_fixtures: number;
      total_survivors: number;
      total_eliminated: number;
      total_picks: number;
    };
  }>('/get-round-results-breakdown', { competition_id, round_number }),

  getRoundStatistics: (competition_id: number, round_id: number) => withCache(
    `round-statistics-${competition_id}-${round_id}`,
    15 * 60 * 1000, // 15 minute cache - matches user-dashboard for consistency
    () => api.post<{
      return_code: string;
      message?: string;
      round_number?: number;
      statistics?: {
        total_players: number;
        won: number;
        lost: number;
        eliminated: number;
      };
    }>('/get-round-statistics', { competition_id, round_id })
  ),
};

// Cache utilities
export const cacheUtils = {
  // Clear competition-related cache when competitions change
  invalidateCompetitions: () => {
    const userId = getUserId();
    apiCache.delete(`user-dashboard-${userId}`);
  },

  // Clear credit and billing cache after purchases or player joins
  invalidateCredits: () => {
    const userId = getUserId();
    apiCache.delete(`user-credits-${userId}`);
    apiCache.delete(`billing-history-${userId}`);
  },

  // Clear billing-related cache after payments (legacy + new system)
  invalidateBilling: () => {
    const userId = getUserId();
    apiCache.delete(`user-subscription-${userId}`); // Legacy
    apiCache.delete(`user-credits-${userId}`);       // New credit system
    apiCache.delete(`billing-history-${userId}`);
  },

  // Clear specific cache key
  invalidateKey: (key: string) => {
    apiCache.delete(key);
  },

  // Clear cache keys matching a pattern
  invalidatePattern: (pattern: string) => {
    apiCache.deletePattern(pattern);
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

// ========================================
// ORGANIZER FIXTURE MANAGEMENT API
// ========================================
// For manual competitions (fixture_service = false)
// Allows organizers to manage fixtures and results for their own competition

export interface OrganizerFixture {
  home_team_short: string;
  away_team_short: string;
}

export interface OrganizerFixtureWithResult {
  id: number;
  home_team_short: string;
  away_team_short: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  result: string | null;
}

export const organizerApi = {
  // Add fixtures to competition's current round
  addFixtures: (competition_id: number, kickoff_time: string, fixtures: OrganizerFixture[]) =>
    api.post('/organizer-add-fixtures', { competition_id, kickoff_time, fixtures }),

  // Get fixtures needing results for current round
  getFixturesForResults: (competition_id: number) =>
    api.post('/organizer-get-fixtures-for-results', { competition_id }),

  // Set single fixture result
  setResult: (fixture_id: number, result: 'home_win' | 'away_win' | 'draw') =>
    api.post('/organizer-set-result', { fixture_id, result }),

  // Process all results for round (eliminations, no-picks, completion)
  processResults: (competition_id: number) =>
    api.post('/organizer-process-results', { competition_id }),

  // Update player permissions (delegated access for results/fixtures/players/promote)
  updatePlayerPermissions: (competition_id: number, player_id: number, permissions: {
    manage_results: boolean;
    manage_fixtures: boolean;
    manage_players: boolean;
    manage_promote: boolean;
  }) => api.post<{
    return_code: string;
    message: string;
    player?: {
      id: number;
      display_name: string;
      manage_results: boolean;
      manage_fixtures: boolean;
      manage_players: boolean;
      manage_promote: boolean;
    };
  }>('/organizer-update-player-permissions', {
    competition_id,
    player_id,
    ...permissions
  })
};

// Onboarding API calls (public)
export interface OnboardingApplicationRequest {
  venueName?: string;
  venueType?: 'pub' | 'club' | 'workplace' | 'friends' | 'other';
  contactName: string;
  email: string;
  phone?: string;
  estimatedPlayers?: number;
  preferredStartDate?: string;
  description?: string;
}

export const onboardingApi = {
  submitApplication: (data: OnboardingApplicationRequest) =>
    api.post<{
      return_code: string;
      message: string;
      application_id?: number;
    }>('/submit-onboarding-application', data)
};

export default api;