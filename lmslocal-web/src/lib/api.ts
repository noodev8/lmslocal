import axios from 'axios';

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

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user');
      
      // Dispatch custom event instead of hard redirect
      if (typeof window !== 'undefined') {
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
  joinCompetition: (access_code: string) => api.post<ApiResponse<{ competition: Competition }>>('/join-competition', { access_code }),
  joinBySlug: (slug: string) => api.post<ApiResponse<{ competition: Competition }>>('/join-competition-by-slug', { slug }),
  registerAndJoin: (name: string, email: string, access_code: string) => api.post<ApiResponse<{ token: string; user: User; competition: Competition }>>('/register-and-join-competition', { name, email, access_code }),
};

// Competition API calls
export const competitionApi = {
  create: (data: CreateCompetitionRequest) => api.post<ApiResponse<{ competition_id: string }>>('/create-competition', data),
  getMyCompetitions: () => api.post<ApiResponse<{ competitions: Competition[] }>>('/mycompetitions', {}),
  getStatus: (competition_id: number) => api.post<ApiResponse<{ current_round: Round | null; fixture_count: number; should_route_to_results: boolean }>>('/get-competition-status', { competition_id }),
  getPlayers: (competition_id: number) => api.post<ApiResponse<{ competition: Competition; players: Player[] }>>('/get-competition-players', { competition_id }),
  removePlayer: (competition_id: number, player_id: number) => api.post<ApiResponse<{ removed_data: Player }>>('/remove-player', { competition_id, player_id }),
  getPickStatistics: (competition_id: number) => api.post<ApiResponse<{ 
    current_round: { round_id: number; round_number: number } | null; 
    players_with_picks: number; 
    total_active_players: number; 
    pick_percentage: number 
  }>>('/get-pick-statistics', { competition_id }),
};

// Round API calls
export const roundApi = {
  create: (competition_id: string, lock_time: string) => 
    api.post<ApiResponse<{ round_id: string }>>('/create-round', { competition_id: parseInt(competition_id), lock_time }),
  getRounds: (competition_id: number) => api.post<ApiResponse<{ rounds: Round[] }>>('/get-rounds', { competition_id }),
  update: (round_id: string, lock_time: string) => api.post<ApiResponse<MessageResponse>>('/update-round', { round_id: parseInt(round_id), lock_time }),
  getPlayerCurrentRound: (competition_id: string) => api.post<ApiResponse<{ round: Round }>>('/get-player-current-round', { competition_id }),
};

// Fixture API calls
export const fixtureApi = {
  addBulk: (round_id: string, fixtures: { home_team: string; away_team: string; kickoff_time: string }[]) => 
    api.post<ApiResponse<MessageResponse>>('/add-fixtures-bulk', { round_id: parseInt(round_id), fixtures }),
  get: (round_id: string) => api.post<ApiResponse<{ fixtures: Fixture[] }>>('/get-fixtures', { round_id: parseInt(round_id) }),
  setResult: (fixture_id: number, result: 'home_win' | 'away_win' | 'draw') =>
    api.post<ApiResponse<MessageResponse>>('/set-fixture-result', { fixture_id, result }),
  getCalculated: (round_id: number) => api.post<ApiResponse<{ calculated_fixture_ids: number[] }>>('/get-calculated-fixtures', { round_id }),
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
  getTeams: () => api.post<ApiResponse<{ teams: Team[] }>>('/get-teams', {}),
  getTeamLists: () => api.post<ApiResponse<{ team_lists: TeamList[] }>>('/team-lists', {}),
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
  getPlayerDashboard: () => api.post<ApiResponse<{ competitions: Competition[] }>>('/player-dashboard', {}),
  getAllowedTeams: (competition_id: number, user_id?: number) => api.post<ApiResponse<{ 
    allowed_teams: Team[];
    teams_reset: boolean;
    reset_message: string | null;
  }>>('/get-allowed-teams', { competition_id, ...(user_id && { user_id }) }),
  checkUserType: () => api.post<ApiResponse<{ user_type: string; suggested_route: string; organized_count: number; participating_count: number; has_organized: boolean; has_participated: boolean }>>('/check-user-type', {}),
  getCompetitionStandings: (competition_id: number) => api.post<ApiResponse<{ competition: Competition; players: Player[] }>>('/get-competition-standings', { competition_id }),
  joinCompetitionByCode: (competition_code: string) => api.post<ApiResponse<{ competition: { id: number; name: string } }>>('/join-competition-by-code', { competition_code }),
};

export default api;