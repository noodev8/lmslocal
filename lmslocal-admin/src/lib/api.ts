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
    // Trailing slash would produce paths like //admin/admin-login
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  return 'http://localhost:3015';
};

/*
Exported so error messages can name the URL actually being called. NEXT_PUBLIC_* values are
inlined at build time, so if this reads localhost on a deployed site the variable was missing
when the build ran and a redeploy is needed - worth being able to see that from the UI.
*/
export const apiBaseUrl = getApiBaseUrl();

// Production home of the player-facing app, used when nothing else tells us where to go.
const PROD_WEB_URL = 'https://www.lmslocal.co.uk';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

/*
Where the player-facing app lives, for "View as organiser" to open a new tab against.

Deliberately resolved at call time rather than module load. NEXT_PUBLIC_* values are inlined at
build time, so a deployed admin build with the variable missing would otherwise bake in
localhost:3000 and send production users to a dev machine. Falling back on the browser's own
hostname means the deploy is correct even with no env config: if the admin tool itself is not
being served from localhost, neither is the player app.
*/
export const getWebBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_WEB_URL) {
    return process.env.NEXT_PUBLIC_WEB_URL.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && !LOCAL_HOSTS.includes(window.location.hostname)) {
    return PROD_WEB_URL;
  }

  return 'http://localhost:3000';
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
  organisers: {
    total: number;
    paying: number;
    with_active_competition: number;
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

export interface ApiResponse {
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
  organiser_id: number | null;
  organiser_name: string | null;
  organiser_email: string | null;
  /* How many competitions this organiser has started in total, not just this one. */
  organiser_competitions: number;
  /*
  Total ever paid across credit_purchases. This - not paid_credit - is what makes someone a
  paying customer: credit can be granted without a purchase behind it.
  */
  organiser_lifetime_spend: number;
  /* Current credit balance. Zero on a paying organiser means they have spent what they bought. */
  organiser_credit: number;
  player_count: number;
  /* Of which are bots. Included in player_count, not additional to it. */
  bot_count: number;
  /* Whether this organiser may use bots at all - see services/botPool.js on the server. */
  bots_allowed: boolean;
  created_at: string;
  last_activity: string;
  /* Opted into the automated fixture service - the flag every push reads. */
  fixture_service: boolean;
  team_list_id: number;
  team_list_name: string | null;
}

/*
One account that owns at least one competition. Helping run someone else's does not make
someone an organiser here - see get-admin-organisers.
*/
export interface AdminOrganiser {
  id: number;
  name: string | null;
  email: string | null;
  email_verified: boolean;
  competitions_total: number;
  competitions_active: number;
  competitions_setup: number;
  competitions_complete: number;
  competitions_on_fixture_service: number;
  /*
  Memberships across their competitions - counted exactly like player_count on the competitions
  screen, so an organiser's total is the sum of their competitions' numbers there. Includes the
  organiser, who joins their own competition on creating it.
  */
  players_total: number;
  /* The same set deduplicated - lower when someone plays in two of their competitions. */
  players_unique: number;
  /* Total ever paid across credit_purchases - what makes someone a paying customer. */
  lifetime_spend: number;
  /* Current credit balance, which can be granted without a purchase behind it. */
  credit: number;
  signed_up_at: string;
  last_active_at: string | null;
  first_competition_at: string;
  /* Newest pick by anyone in their competitions - engagement, as opposed to their own. */
  last_player_activity: string | null;
}

export type OrganisersResponse = ApiResponse & {
  organisers?: AdminOrganiser[];
  generated_at?: string;
};

export interface AdminTeam {
  id: number;
  name: string;
  short_name: string;
}

export interface FixtureTeamList {
  id: number;
  name: string;
  type: string;
  season: string | null;
  /* True blocks staging a new batch - this list already has one staged that isn't fully resulted and pushed. */
  pending_fixtures: boolean;
  /* Earliest kickoff of the pending batch, or null if none. The round's lock time once pushed. */
  pending_cutoff: string | null;
  teams: AdminTeam[];
}

export interface StagedFixture {
  fixture_id: number;
  home_team_short: string;
  away_team_short: string;
  home_team_name: string;
  away_team_name: string;
  kickoff_time: string;
  /* Both null means no result entered yet. Once set, the row is locked in the results UI. */
  home_score: number | null;
  away_score: number | null;
}

/* One fixture as entered in the UI, before it is staged. */
export interface FixturePair {
  home_team_short: string;
  away_team_short: string;
}

export type ResultOutcome = 'home_win' | 'away_win' | 'draw';

export type TeamListsResponse = ApiResponse & {
  team_lists?: FixtureTeamList[];
  /* Set when FIXTURE_SERVICE_TEST_MODE is active in the server .env - pushes only reach this organiser's competitions. */
  test_mode_email?: string | null;
};

export type AddFixturesResponse = ApiResponse & {
  fixtures_added?: number;
  team_list_name?: string;
};

export type StagedResultsResponse = ApiResponse & {
  fixtures?: StagedFixture[];
  total_fixtures?: number;
  remaining_fixtures?: number;
};

export type SetStagedResultResponse = ApiResponse & {
  fixture_id?: number;
  home_score?: number;
  away_score?: number;
  result?: ResultOutcome;
};

export type PushFixturesResponse = ApiResponse & {
  competitions_updated?: number;
  competitions_skipped?: number;
  fixtures_pushed?: number;
};

/* One competition a staged batch is waiting on. The three fixture counts are what the screen
   turns into a row state - see get-push-targets.js for the mapping. */
export interface PushTarget {
  competition_id: number;
  name: string;
  organiser_email: string;
  organiser_name: string;
  players: number;
  active_players: number;
  fixtures_pending: number;
  fixtures_unprocessed: number;
  fixtures_done: number;
}

export type PushTargetsResponse = ApiResponse & {
  staged_total?: number;
  staged_resulted?: number;
  cutoff?: string | null;
  competitions?: PushTarget[];
};

export type PushOneResponse = ApiResponse & {
  competition_id?: number;
  competition_name?: string;
  fixtures_updated?: number;
  fixtures_processed?: number;
  players_eliminated?: number;
  no_pick_penalties?: number;
  competition_status?: string;
  active_players_remaining?: number;
};

export type ClearBatchResponse = ApiResponse & {
  rows_cleared?: number;
  forced?: boolean;
  competitions?: { competition_id: number; name: string; fixtures_pending: number; fixtures_unprocessed: number }[];
};

export type SetFixtureServiceResponse = ApiResponse & {
  competition_id?: number;
  competition_name?: string;
  fixture_service?: boolean;
  /* Present on ROUND_IN_PROGRESS - enough detail to show the admin exactly what they'd be overriding. */
  round_number?: number;
  total_fixtures?: number;
  unresolved_fixtures?: number;
};

/* One member of the shared bot pool. The same bot can be in any number of competitions. */
export interface Bot {
  id: number;
  display_name: string;
  email: string;
  /* How many competitions it is currently in - which bots are already busy. */
  competitions: number;
}

/* A competition bots are allowed in, i.e. one run by an organiser in BOT_ORGANISER_IDS. */
export interface BotCompetition {
  id: number;
  name: string;
  /* As stored. Casing is inconsistent platform-wide - 'ACTIVE' here, 'active' on the
     competitions screen, which normalises it. */
  status: string;
  player_count: number;
  bot_count: number;
  round_number: number | null;
  lock_time: string | null;
  is_locked: boolean;
  /* False once round 2 exists or round 1 has locked - the same window real players get. */
  can_add_bots: boolean;
  closed_reason: string | null;
}

export interface BotFixture {
  fixture_id: number;
  /* What a pick stores, and what set-bot-pick expects. */
  home_team_short: string;
  away_team_short: string;
  home_team_name: string;
  away_team_name: string;
  kickoff_time: string;
}

export interface BotMembership {
  user_id: number;
  display_name: string;
  status: string;
  lives_remaining: number | null;
  pick_team: string | null;
  pick_fixture_id: number | null;
  /* What this bot may still pick, from allowed_teams - the same table the player pick screen
     reads and set-pick.js validates against. */
  available_teams: string[];
  /* Teams used in earlier rounds. Excludes this round, so the current pick can be changed to
     anything else without the team it is on counting as spent. */
  used_teams: string[];
}

export interface BotCompetitionDetail {
  competition_id: number;
  no_team_twice: boolean;
  round_id: number | null;
  round_number: number | null;
  lock_time: string | null;
  is_locked: boolean;
  fixtures: BotFixture[];
  members: BotMembership[];
}

export type BotsResponse = ApiResponse & {
  bots?: Bot[];
  competitions?: BotCompetition[];
  detail?: BotCompetitionDetail | null;
};

export type CreateBotsResponse = ApiResponse & {
  bots_created?: number;
  pool_size?: number;
  bots?: { id: number; display_name: string; email: string }[];
};

export type AddBotsResponse = ApiResponse & {
  bots_added?: number;
  bots_requested?: number;
  bots_available?: number;
  bots?: { id: number; display_name: string }[];
};

export type RemoveBotResponse = ApiResponse & {
  removed?: {
    user_id: number;
    display_name: string;
    picks_deleted: number;
    allowed_teams_deleted: number;
    progress_deleted: number;
  };
  bots_remaining?: number;
};

export type SetBotPicksResponse = ApiResponse & {
  picks_made?: number;
  bots_without_pick?: number;
  round_number?: number;
  /* Bots with no legal team left. Normal on a long competition with no-team-twice on. */
  skipped_no_teams?: number;
};

export type SetBotPickResponse = ApiResponse & {
  user_id?: number;
  display_name?: string;
  team?: string | null;
  fixture_id?: number | null;
  round_number?: number;
};

export type CompetitionsResponse = ApiResponse & {
  competitions?: AdminCompetition[];
  generated_at?: string;
};

export type ImpersonateResponse = ApiResponse & {
  token?: string;
  user?: { id: number; email: string; display_name: string };
  competition_id?: number;
};

export type DeleteCompetitionResponse = ApiResponse & {
  deletion_summary?: {
    competition_id: number;
    competition_name: string;
    players_removed: number;
    guest_users_deleted: number;
    rounds_deleted: number;
    fixtures_deleted: number;
    picks_deleted: number;
    progress_records_deleted: number;
    allowed_teams_deleted: number;
    deleted_at: string;
  };
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

  getOrganisers: async (): Promise<OrganisersResponse> => {
    const response = await api.get<OrganisersResponse>('/admin/get-admin-organisers');
    return response.data;
  },

  impersonateOrganiser: async (competitionId: number): Promise<ImpersonateResponse> => {
    const response = await api.post<ImpersonateResponse>('/admin/impersonate-organiser', {
      competition_id: competitionId,
    });
    return response.data;
  },

  deleteCompetition: async (competitionId: number): Promise<DeleteCompetitionResponse> => {
    const response = await api.post<DeleteCompetitionResponse>('/admin/delete-admin-competition', {
      competition_id: competitionId,
    });
    return response.data;
  },

  setFixtureService: async (
    competitionId: number,
    fixtureService: boolean,
    overrideRoundInProgress?: boolean
  ): Promise<SetFixtureServiceResponse> => {
    const response = await api.post<SetFixtureServiceResponse>('/admin/set-fixture-service', {
      competition_id: competitionId,
      fixture_service: fixtureService,
      ...(overrideRoundInProgress ? { override_round_in_progress: true } : {}),
    });
    return response.data;
  },

  // ---- Fixture staging -------------------------------------------------------------------

  getFixtureTeamLists: async (): Promise<TeamListsResponse> => {
    const response = await api.get<TeamListsResponse>('/admin/get-fixture-team-lists');
    return response.data;
  },

  addStagedFixtures: async (
    teamListId: number,
    kickoffTimeIso: string,
    fixtures: FixturePair[]
  ): Promise<AddFixturesResponse> => {
    const response = await api.post<AddFixturesResponse>('/admin/add-staged-fixtures', {
      team_list_id: teamListId,
      kickoff_time: kickoffTimeIso,
      fixtures,
    });
    return response.data;
  },

  getStagedResults: async (teamListId: number): Promise<StagedResultsResponse> => {
    const response = await api.get<StagedResultsResponse>('/admin/get-staged-results', {
      params: { team_list_id: teamListId },
    });
    return response.data;
  },

  setStagedResult: async (fixtureId: number, result: ResultOutcome): Promise<SetStagedResultResponse> => {
    const response = await api.post<SetStagedResultResponse>('/admin/set-staged-result', {
      fixture_id: fixtureId,
      result,
    });
    return response.data;
  },

  // ---- Distribution ----------------------------------------------------------------------

  pushFixtures: async (): Promise<PushFixturesResponse> => {
    const response = await api.post<PushFixturesResponse>('/admin/push-fixtures-to-competitions');
    return response.data;
  },

  // Results go out one competition at a time. The all-competitions route is gone: it ran the
  // whole batch in one transaction, so a timeout rolled every competition back.
  getPushTargets: async (teamListId: number): Promise<PushTargetsResponse> => {
    const response = await api.get<PushTargetsResponse>('/admin/get-push-targets', {
      params: { team_list_id: teamListId },
    });
    return response.data;
  },

  pushResultsToCompetition: async (competitionId: number): Promise<PushOneResponse> => {
    const response = await api.post<PushOneResponse>('/admin/push-results-to-competition', {
      competition_id: competitionId,
    });
    return response.data;
  },

  clearStagedBatch: async (teamListId: number, force = false): Promise<ClearBatchResponse> => {
    const response = await api.post<ClearBatchResponse>('/admin/clear-staged-batch', {
      team_list_id: teamListId,
      force,
    });
    return response.data;
  },

  // ---- Bots ------------------------------------------------------------------------------
  // Bots are only allowed in competitions run by an approved organiser - see
  // services/botPool.js on the server for why. Every route below enforces that, so a
  // competition missing from getBots().competitions is not a bug.

  getBots: async (competitionId?: number): Promise<BotsResponse> => {
    const response = await api.get<BotsResponse>('/admin/get-bots', {
      params: competitionId ? { competition_id: competitionId } : undefined,
    });
    return response.data;
  },

  createBots: async (count: number): Promise<CreateBotsResponse> => {
    const response = await api.post<CreateBotsResponse>('/admin/create-bots', { count });
    return response.data;
  },

  addBotsToCompetition: async (competitionId: number, count: number): Promise<AddBotsResponse> => {
    const response = await api.post<AddBotsResponse>('/admin/add-bots-to-competition', {
      competition_id: competitionId,
      count,
    });
    return response.data;
  },

  removeBotFromCompetition: async (competitionId: number, userId: number): Promise<RemoveBotResponse> => {
    const response = await api.post<RemoveBotResponse>('/admin/remove-bot-from-competition', {
      competition_id: competitionId,
      user_id: userId,
    });
    return response.data;
  },

  setBotPicks: async (competitionId: number, count: number): Promise<SetBotPicksResponse> => {
    const response = await api.post<SetBotPicksResponse>('/admin/set-bot-picks', {
      competition_id: competitionId,
      count,
    });
    return response.data;
  },

  // team is a short name ("ARS"), or null to clear the pick.
  setBotPick: async (
    competitionId: number,
    userId: number,
    team: string | null
  ): Promise<SetBotPickResponse> => {
    const response = await api.post<SetBotPickResponse>('/admin/set-bot-pick', {
      competition_id: competitionId,
      user_id: userId,
      team,
    });
    return response.data;
  },
};

export default api;
