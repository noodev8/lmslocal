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

/**
 * Tear down the session locally and tell the app the token is gone.
 *
 * The `expired` detail separates this from a deliberate sign-out, which raises the
 * same event: an expiry has to land the user on /login, a sign-out on the home page.
 */
const handleAuthExpiry = () => {
  // Only access localStorage on client-side to avoid hydration issues
  if (typeof window === 'undefined') return;

  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user');

  // Clear all cache when auth expires - simple and safe
  apiCache.clear();

  window.dispatchEvent(new CustomEvent('auth-expired', { detail: { expired: true } }));
};

// Response interceptor to handle token expiration AND detailed error logging
api.interceptors.response.use(
  (response) => {
    // The server answers HTTP 200 to everything and puts the outcome in return_code
    // (see CLAUDE.md), so an expired token arrives here, not in the error handler below —
    // which left the 401 branch unreachable for every route behind verifyToken. Without
    // this, a session that expired while the page sat open produced only that screen's own
    // failure text, and every retry failed the same way with no way back to a sign-in.
    if (response.data?.return_code === 'UNAUTHORIZED') {
      handleAuthExpiry();
    }
    return response;
  },
  (error) => {
    // Handle authentication errors
    if (error.response?.status === 401) {
      handleAuthExpiry();
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

// One competition's share of the free/paid places, for the "where did my places go" panel.
// A place is held for as long as the competition exists, so finished competitions appear here too.
export interface PlaceUsage {
  competition_id: number;
  name: string;
  status: string;                    // Upper-cased competition status
  status_label: string;              // Human label; empty string if the status is unrecognised

  /* `places` is the total and the only figure that sums to the headline. `members` and `re_buys`
     are the two halves of it, carried so the panel can show its working - a competition with 8
     players reading 10 places looks like a bug unless it says why. docs/re-buys.md §4. */
  places: number;                    // Chargeable places this competition holds
  members: number;                   // Chargeable players in it
  re_buys: number;                   // Extra places consumed by players buying back in
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
  venue_name?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  entry_fee?: number | null;
  prize_structure?: string | null;
  is_organiser: boolean;
  is_participant?: boolean;
  organiser_id?: number;
  player_count: number;
  total_players?: number;
  current_round: number;
  current_round_lock_time?: string;
  // Counts, not rows: enough for the dashboard tile to reach every phase without shipping the
  // fixture list to a screen that only needs a subtitle.
  total_fixtures?: number;
  fixtures_with_results?: number;
  fixtures_processed?: number;
  fixture_service?: boolean;
  /** Organiser has pressed Ready. Null on a fixture service competition means it is waiting. */
  ready_at?: string | null;
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
  player_display_name?: string | null;
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
  /** True for one of our bots. Derived server-side from the bot email pattern (services/botPool.js). */
  is_bot?: boolean;
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
  /**
   * Both are sent for the API's benefit and validated nowhere on the server — it checks neither.
   * Consent is given by submitting the form, which says so above the button, so `acceptTerms` is
   * always true by the time this is called rather than a field anyone ticks.
   */
  confirmPassword?: string;
  acceptTerms?: boolean;
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
  entry_fee?: number;
  prize_structure?: string;
  access_code?: string;
  team_list_id: number;
  lives_per_player: number;
  no_team_twice: boolean;
  organiser_joins_as_player: boolean;
  fixture_service?: boolean;
  /* Which round 1 the competition starts on, from getStartOptions. Fixture-service competitions
     only. Omitted when the calendar has nothing to offer, which falls back to the Ready button. */
  start_block_id?: number;
}

/* One date a competition can start on. Deliberately carries no fixtures: the organiser is
   choosing WHEN they start, not which matches they get. See docs/competition-start.md. */
export interface StartOption {
  block_id: number;
  label: string;
  /* When round 1 locks - which is also when joining closes, the thing to put in front of them. */
  lock_time: string;
  fixture_count: number;
  /* True for the batch already staged and going out - normally the soonest date on offer. */
  staged?: boolean;
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
  entry_fee?: number;
  prize_structure?: string;
  lives_per_player?: number;
  no_team_twice?: boolean;
  // fixture_service is set once at creation and ignored by update-competition - changed in the
  // database on request until the mid-competition switch is worked through.
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
  /* Which block the rebuilt round 1 comes from. A reset competition is an empty screen just like
     a new one, so it asks the same question. Omitted falls back to the Ready button. */
  start_block_id?: number;
  // The price the organiser was shown. The server refuses with QUOTE_STALE rather than charging
  // more than this, so a player joining mid-confirmation cannot produce a surprise debit.
  quoted_cost?: number;
}

export interface ResetCompetitionResponse {
  credits_used: number;
  credits_remaining: number;
  competition: {
    id: number;
    name: string;
    status: string;
    invite_code: string;
    reset_at: string;
    players_affected: number;
  };
}

export interface ResetQuoteRequest {
  competition_id: number;
}

export interface ResetQuoteResponse {
  cost: number;                 // places the reset will use; 0 means free
  balance: number;              // organiser's current credit balance
  affordable: boolean;
  chargeable_players: number;   // members of this competition who cost a place
  free_limit: number;
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
    deleted_at: string;
  };
}


// Auth API calls
export const authApi = {
  // message is present only on failure, and carries the reason - both routes write user-facing
  // copy per validation case, which callers should show rather than inventing a generic retry.
  login: (data: LoginRequest) => api.post<{ return_code: string; token: string; user: User; message?: string }>('/login', data),
  register: (data: RegisterRequest) => api.post<{ return_code: string; token: string; user: User; message?: string }>('/register', data),
  forgotPassword: (email: string) => api.post<{ return_code: string; message: string }>('/forgot-password', { email }),
  resetPassword: (token: string, new_password: string) => api.post<{ return_code: string; message: string }>('/reset-password', { token, new_password }),
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
// Public contact form in the help centre. Unauthenticated on purpose — someone who cannot sign
// in is the person most likely to need to reach us.
export const supportApi = {
  sendMessage: (data: {
    name: string;
    email: string;
    subject: string;
    message: string;
    website?: string;
  }) => api.post<{ return_code: string; message?: string }>('/submit-contact-message', data),
};

export const competitionApi = {
  // Public, unauthenticated lookup used by /join/[code]. Lets a player see what they are joining
  // before we ask them to sign in or create an account, so a typo costs them nothing.
  //
  // `competition` is present ONLY on SUCCESS, which the server returns only for a competition
  // that can still be joined. A started competition and a code that never existed both come back
  // as COMPETITION_NOT_FOUND with nothing attached, on purpose. COMPETITION_FULL is the single
  // exception and carries organiser_name so the player knows who to ask. See §4.3 of
  // docs/player-onboarding.md before adding anything to a non-SUCCESS response.
  getByCode: (competition_code: string) => api.post<{
    return_code: string;
    message?: string;
    organiser_name?: string | null;
    competition?: {
      id: number;
      name: string;
      venue_name: string | null;
      organiser_name: string | null;
      logo_url: string | null;
      description: string | null;
      player_count: number;
    };
  }>('/get-competition-by-code', { competition_code }),

  // Authenticated companion to getByCode. Answers only "am I already in this one?", so the join
  // page can send an existing member straight to the competition instead of showing them a Join
  // button for something they already joined. Says nothing about why a competition is unjoinable
  // — that stays getByCode's business.
  getJoinStatus: (competition_code: string) => api.post<{
    return_code: string;
    message?: string;
    is_member?: boolean;
    competition_id?: number | null;
  }>('/get-join-status', { competition_code }),
  create: (data: CreateCompetitionRequest) => api.post<{ return_code: string; message?: string; competition?: Competition & { start_block_label?: string | null }; competition_id?: string }>('/create-competition', data),

  // The dates a new competition can start on, for the create wizard and the reset dialog.
  //
  // Not cached. A block can be staged or edited by an operator at any moment, and an option that
  // has gone stale fails at submit with START_BLOCK_UNAVAILABLE - a poor way to find out.
  getStartOptions: (team_list_id: number) =>
    api.get<{
      return_code: string;
      message?: string;
      options?: StartOption[];
      /* Which to preselect - the second of three. A week is enough to recruit; longer loses
         attention. Null when nothing is available. */
      recommended_block_id?: number | null;
    }>('/get-competition-start-options', { params: { team_list_id } }),
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
    // is_guest covers guests and bots alike: neither can sign in, so the organiser is the only
    // one who can pick for them.
    unpicked_players?: Array<{ user_id: number; display_name: string; is_guest?: boolean }>;
    total_unpicked?: number;
  }>('/get-unpicked-players', { competition_id, round_id }),
  update: (data: UpdateCompetitionRequest) => api.post<UpdateCompetitionResponse & { return_code: string; message?: string }>('/update-competition', data),
  reset: (data: ResetCompetitionRequest) => api.post<ResetCompetitionResponse & { return_code: string; message?: string; required?: number; balance?: number }>('/reset-competition', data),

  // What starting again will cost, so the organiser sees the price before the button rather than
  // by pressing it. Read-only - nothing is charged here.
  getResetQuote: (data: ResetQuoteRequest) => api.post<ResetQuoteResponse & { return_code: string; message?: string }>('/get-reset-quote', data),

  // The organiser's start gate. `ready` false puts it back on hold, which the backend allows
  // right up until the first round exists.
  // Publishes the first round then and there when the staged batch already qualifies, so
  // `round_started` decides whether the caller is landing on a live round or still waiting.
  setReady: (competition_id: number, ready: boolean) =>
    api.post<{
      return_code: string;
      ready_at: string | null;
      round_started?: boolean;
      round_number?: number | null;
      message?: string;
    }>('/set-competition-ready', { competition_id, ready }),

  // When their first round would actually start. Three answers - not ready, a date, or ready with
  // nothing staged - computed by the same rules the push uses.
  getStartOutlook: (competition_id: number) =>
    api.get<{
      return_code: string;
      ready_at: string | null;
      starts_at: string | null;
      waiting_for_fixtures: boolean;
      // Gates the Ready button: it may only be pressed when a round is actually available.
      // current_batch_kickoff is set when a batch exists but they cannot have it, and is the date
      // to send them back after; null when nothing is staged, where no date exists to give.
      can_start?: boolean;
      blocked_reason?: string | null;
      current_batch_kickoff?: string | null;
      // The batch behind starts_at, so a date can be shown as a real gameweek. Preview only -
      // empty whenever there is no date.
      fixtures: { home_team: string; away_team: string; kickoff_time: string }[];
    }>(`/get-competition-start-outlook?competition_id=${competition_id}`),
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
  getCurrentPick: (round_id: number) => api.post<{
    return_code: string;
    // Null rather than absent when no pick has been made - the route distinguishes the two.
    pick?: { team: string; team_full_name?: string; fixture_id: number; fixture?: string } | null;
  }>('/get-current-pick', { round_id }),
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

  /*
  Player status management. ONE DIRECTION: this marks a player out.

  Sending status 'active' for an eliminated player comes back USE_RE_BUY - bringing someone back
  consumes a place and goes through buyPlayerBackIn below. See docs/re-buys.md §2.
  */
  updatePlayerStatus: (competition_id: number, player_id: number, status: 'active' | 'out', reason?: string) => api.post<{
    return_code: string;
    message?: string;
    player_name?: string;           // Player display name
    old_status?: string;            // Previous status
    new_status?: string;            // New status
  }>('/update-player-status', { competition_id, player_id, status, reason }),

  /*
  Bring an eliminated player back in. Consumes one place, priced exactly as a join - free inside
  the organiser's free allowance, one credit beyond it.

  `credit_charged` is what the caller should react to, not the balance: it is false both when the
  organiser is inside their allowance and when the player is a bot, and in neither case should the
  UI say anything about credits at all (docs/reset-billing.md §7).
  */
  buyPlayerBackIn: (competition_id: number, player_id: number, reason?: string) => api.post<{
    return_code: string;
    message?: string;
    player_name?: string;           // Player display name
    lives_remaining?: number;       // Lives the player returns on (always 0 - back in, no cushion)
    re_buys?: number;               // Times this player has now bought back in
    credit_charged?: boolean;       // Whether a credit was actually taken
    new_balance?: number;           // Organiser's paid_credit after the charge
    places_used?: number;           // Organiser's chargeable places after the re-buy
    credits_available?: number;     // On INSUFFICIENT_CREDITS: what they actually have
  }>('/buy-player-back-in', { competition_id, player_id, reason }),
};

// User profile
/*
Email preferences are grouped by consumer x section from docs/email/email-outline.xlsx, not by
individual email - what someone switches off is "game updates", never "Round Over specifically".
The group keys and their labels come from the server (services/emailPreference.js) rather than
being listed here, so adding a group does not need a matching change in this file.
*/
export interface EmailGroupLabel {
  consumer: string;
  section: string;
  label: string;
  blurb: string;
}

export interface EmailPreferences {
  global: {
    /* Master switch. False means nothing at all, whatever the groups say. */
    all_emails: boolean;
    /* Keyed by group, e.g. "player.game". True means subscribed. */
    groups: Record<string, boolean>;
    group_labels: Record<string, EmailGroupLabel>;
  };
  competition_specific: Array<{
    competition_id: number;
    competition_name: string;
    personal_name: string | null;
    /* Mute this competition entirely - a separate axis from the groups. */
    all_emails: boolean;
  }>;
}

export const userApi = {
  updateProfile: (updates: Partial<User>) => api.post<{ return_code: string; message?: string; user?: User }>('/update-profile', updates),
  changePassword: (current_password: string, new_password: string) => api.post<{ return_code: string; message: string }>('/change-password', { current_password, new_password }),
  deleteAccount: (confirmation: string) => api.post<{ return_code: string; message: string }>('/delete-account', { confirmation }),
  updatePlayerDisplayName: (competition_id: number, player_display_name: string | null) => api.post<{
    return_code: string;
    message?: string;
    player_display_name?: string | null
  }>('/update-player-display-name', { competition_id, player_display_name }),
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
        user?: {
          id: number;
          display_name: string;
          email: string;
          email_verified: boolean;
        };
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
        /**
         * Players turned away in the last 7 days because this organiser is at their credit
         * limit. null when there were none — so the UI shows nothing rather than a
         * reassuring zero. `total` is a FLOOR, never an exact headcount: repeat visits inside a
         * short window collapse to one, and anyone who never opened the link is invisible.
         */
        blocked_joins?: {
          total: number;
          competitions: { competition_id: number; name: string; count: number }[];
          // Summary only — the breakdown of WHICH competitions hold the credits lives on
          // /billing, beside the buy button. See services/placeUsage.js.
          places_used: number;
          places_limit: number;
        } | null;
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
        place_usage?: PlaceUsage[];
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
        description?: string | null;
        status: string;
        invite_code: string;
        join_url: string;
        game_url: string;
        total_players: number;
        logo_url?: string | null;
        entry_fee?: number | null;
        prize_structure?: string | null;
        start_date?: string;
        lives_per_player?: number;
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
        show_draw: boolean;
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
    unlucky_pick?: {
      team: string;
      team_short: string;
      eliminated: number;
    } | null;
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

/*
Re-exported, not redefined. There used to be a second cacheUtils here with the same name and
different behaviour to the one in cache.ts, so which invalidation a caller got depended on which
module they happened to import from - and the two disagreed about several keys. One object now.
*/
export { cacheUtils } from './cache';

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
  /** Winning team's short code, or the literal 'DRAW'. Not 'home_win'/'away_win'. */
  result: string | null;
  /** Timestamp the eliminations for this fixture were applied, or null. Not a boolean. */
  processed: string | null;
}

export const organizerApi = {
  // Add fixtures to competition's current round
  addFixtures: (competition_id: number, kickoff_time: string, fixtures: OrganizerFixture[]) =>
    api.post('/organizer-add-fixtures', { competition_id, kickoff_time, fixtures }),

  // Get fixtures needing results for current round
  getFixturesForResults: (competition_id: number) =>
    api.post('/organizer-get-fixtures-for-results', { competition_id }),

  // Set single fixture result
  // 'clear' un-sets a result entered by mistake. Refused once the fixture is processed, same as
  // any other change.
  setResult: (fixture_id: number, result: 'home_win' | 'away_win' | 'draw' | 'clear') =>
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