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
    /* Stored name; both screens LABEL this "Pending". */
    setup: number;
    active: number;
    complete: number;
    /* Tyre kickers. Counted once, here, and never also as active or setup - so the four
       sum to total and agree with the Competitions screen's tiles. */
    stalled: number;
  };
  organisers: {
    /* Cumulative: anyone who ever owned a competition. Only ever rises. */
    total: number;
    /* Owning something ACTIVE or PENDING that is not archived - the same people the Organisers
       screen lists, so the card and that screen show the same number. This one can fall. */
    live: number;
    paying: number;
    with_active_competition: number;
  };
  players: {
    total_memberships: number;
    unique_players: number;
    players_in_live_competition: number;
    still_in: number;
    eliminated: number;
  };
  users: {
    total: number;
    new_last_30_days: number;
    guests: number;
    /*
    In a competition that is live right now - neither complete nor stalled. Eliminated players
    count: they are real people in a competition that is still running. A strict subset of
    "total". The rule is the server's, and which competitions are live comes from the same
    definition the Competitions screen uses.
    */
    active: number;
    /* Guests in a live competition. Real people, but never part of "total" - they never signed up. */
    active_guests: number;
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
  /* Of which are still in - not yet eliminated. NOT the same "active" as the people cards on
     the competitions screen, which count members of a live competition including eliminated
     ones. */
  still_in_count: number;
  /* Of which are bots. Included in player_count, not additional to it. */
  bot_count: number;
  /* Whether this organiser may use bots at all - see services/botPool.js on the server. */
  bots_allowed: boolean;
  created_at: string;
  /*
  Round 1's lock time - when picks close and the competition is under way. Null while it has no
  round at all. Only shown on the competitions screen for setup rows; once started, the date is
  behind us and last_activity answers the more useful question.
  */
  start_date: string | null;
  last_activity: string;
  /* Opted into the automated fixture service - the flag every push reads. */
  fixture_service: boolean;
  team_list_id: number;
  team_list_name: string | null;
  /* Members who are neither the organiser nor a bot - i.e. how many people actually turned up. */
  real_player_count: number;
  /* Picks ever made, across every round. Zero means the competition was never played. */
  pick_count: number;
  /* Whole days since last_activity. */
  quiet_days: number;
  /*
  The tyre-kicker verdict, and the one thing this screen counts by: nobody but the organiser ever
  did anything and it has gone quiet. Defined once on the server in
  services/competitionEngagement.js - never re-derive it here, or the tiles and the tab will
  drift apart.
  */
  is_stalled: boolean;
  /* "derived" when the rule decided, "admin" when someone overrode it. */
  stalled_source: 'derived' | 'admin';
  /* The stored override: true forces stalled, false forces real, null trusts the rule. */
  stalled_override: boolean | null;
  /* Why it was called stalled, ready to show - null when it is not. */
  stalled_reason: string | null;
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
  People they RECRUITED: memberships across their competitions, excluding bots and excluding the
  organiser's own. Deliberately not player_count on the competitions screen, which counts every
  membership, and deliberately not chargeable_players below - the organiser costs a credit while
  never being somebody they recruited.
  */
  players_total: number;
  /* The same set deduplicated - lower when someone plays in two of their competitions. */
  players_unique: number;
  /* Memberships that count for billing: bots and guests excluded, per services/botPool.js. */
  chargeable_players: number;
  /* The unused part of the free allowance. */
  free_places_left: number;
  /* Free places left PLUS credit bought - how many more players they could take on right now.
     Not the same as `credit`, which is only the bought half and reads zero for anyone who has
     never had to buy. */
  credits_available: number;
  /* Real money paid in the last 12 months. Excludes Stripe test-mode sessions, which took none. */
  spend_12m: number;
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
};

export type AddFixturesResponse = ApiResponse & {
  fixtures_added?: number;
  team_list_name?: string;
};

/* ---- Fixture calendar ---------------------------------------------------------------------
   A block is a future round's fixtures, keyed weeks ahead and held alongside others - which is
   what fixture_load cannot do, since it may only hold the one batch going out. Promoting a block
   copies it into fixture_load, and everything downstream of that is unchanged.
   See docs/competition-start.md. */

export interface BlockFixture {
  id: number;
  home_team_short: string;
  away_team_short: string;
  home_team_name: string;
  away_team_name: string;
  kickoff_time: string;
}

export interface FixtureBlock {
  id: number;
  /* What an organiser is shown when picking a start date, e.g. 'Sat 29 Aug'. */
  label: string;
  /* Only a block that starts a gameweek may be a competition's first round. */
  opens_gameweek: boolean;
  /* Set once promoted into fixture_load. Non-null means frozen - no more editing or deleting. */
  staged_at: string | null;
  created_at: string;
  /* MIN kickoff across the block's fixtures - the lock time its round will get. Null if empty. */
  lock_time: string | null;
  /* Competitions whose first round came from this block. Above zero blocks deletion. */
  competition_count: number;
  /* Rows still sitting in fixture_load. staged_at never clears, so this is what separates the
     gameweek going out now from one already played and closed. */
  in_staging: boolean;
  fixtures: BlockFixture[];
}

/* One fixture as entered in the calendar UI, before it is saved. Unlike a staged batch, each
   carries its own kickoff - a Saturday block holds a real 12:30 and a real 15:00. */
export interface BlockFixtureInput {
  home_team_short: string;
  away_team_short: string;
  kickoff_time: string;
}

export type FixtureBlocksResponse = ApiResponse & {
  blocks?: FixtureBlock[];
  /* True when fixture_load already holds a batch for this list, so nothing can be promoted. */
  pending_batch?: boolean;
};

export type SaveFixtureBlockResponse = ApiResponse & {
  block_id?: number;
  fixtures_added?: number;
};

export type PromoteFixtureBlockResponse = ApiResponse & {
  block_id?: number;
  fixtures_staged?: number;
  team_list_id?: number;
  lock_time?: string;
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

/* One competition the staged batch may or may not be pushed to. Blocked ones are listed too,
   with the reason, so a competition missing its fixtures never has to be explained by opening a
   database - see get-fixture-push-targets.js. */
export interface FixturePushTarget {
  competition_id: number;
  name: string;
  organiser_email: string;
  organiser_name: string;
  players: number;
  active_players: number;
  round_number: number | null;
  round_state: 'no_round' | 'blank_round' | 'round_complete' | 'round_in_progress';
  eligible: boolean;
  reason: string | null;
}

export type FixturePushTargetsResponse = ApiResponse & {
  staged_total?: number;
  earliest_kickoff?: string | null;
  competitions?: FixturePushTarget[];
};

export type PushFixturesOneResponse = ApiResponse & {
  competition_id?: number;
  competition_name?: string;
  round_number?: number;
  round_action?: 'created' | 'populated';
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
  /*
  Entered results this competition has not received yet. Zero means pressing Push would do
  nothing and come back ALREADY_PUSHED - which is what the button disables on. Distinct from
  fixtures_pending, which counts every unresulted fixture and so reads the same on every row
  until the whole gameweek is in.
  */
  results_to_push: number;
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
  /* Calendar blocks the batch came from, deleted with it - a closed gameweek is not kept. */
  blocks_deleted?: number;
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
  /*
  Also on ROUND_IN_PROGRESS: whether a staged batch could actually reach that round. The push
  matches on home team + away team + kickoff time, and an organiser's hand-keyed kickoff often
  differs, which leaves a taken-over round matching nothing and unresolvable by anyone.
  batch_staged false means there is no batch to compare against, not that it is safe.
  */
  batch_staged?: boolean;
  matched_fixtures?: number;
  round_kickoff?: string | null;
  batch_kickoff?: string | null;
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
  /* Days of silence the server's rule requires before it will call a competition stalled. */
  quiet_days_threshold?: number;
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
// Emails
// ======================================================================================

/*
Counts are keyed by the outline's email key. A key can be absent when the server cannot work that
email out yet - which is not the same as nobody qualifying. The screen shows a dash for one and a
zero for the other.
*/
export interface EmailCount {
  /* Qualify right now, with no queue row. */
  waiting: number;
  /* Actually delivered in the last 30 days. Excludes 'skipped' - marking somebody as sent must
     not read back as an email they received. */
  sent_recently: number;
  /* Competitions the waiting recipients span. Zero on platform-wide emails, which have none. */
  competitions: number;
}

export type EmailTargetsResponse = ApiResponse & {
  counts?: Record<string, EmailCount>;
};

export interface EmailRecipient {
  user_id: number;
  email: string;
  display_name: string;
  /* Identity is the user AND the competition: the same person appears once per competition they
     joined when a scoped email is previewed across all of them. */
  competition_id: number | null;
  competition_name: string | null;
  /* When they became a candidate - joined, or created. How a fresh one is told from a backlog. */
  since: string | null;
  /* Only meaningful on round-based emails. Null on the platform-wide ones. */
  round_number: number | null;
  /* Whether they let the round go by without picking. Null - not false - on every email that has
     no pick behind it, so a missing answer is never read as "they picked". */
  missed_pick: boolean | null;
  /* Whether they run the competition on this row. Same null convention as missed_pick: an email
     whose service does not answer the question sends null, and the panel hides the filter. */
  is_organiser: boolean | null;
}

export type MarkEmailsSentResponse = ApiResponse & {
  marked?: number;
  /* Fresh count after marking. Anything but zero after a bulk mark means the skip rows did not
     match the service's own guard - see services/emailSkip.js. */
  still_waiting?: number;
  expected_count?: number;
  actual_count?: number;
};

export type PreviewEmailResponse = ApiResponse & {
  recipient_count?: number;
  recipients?: EmailRecipient[];
  truncated?: boolean;
  /* Heading for the `since` column - "Joined" on a welcome, "When" otherwise. Server-derived from
     the same chain that picks the value, so it cannot name a column the rows do not carry. */
  since_label?: string;
  /* Rendered from the real template for the first recipient. Null when nobody qualifies. */
  sample?: {
    for_email: string;
    subject: string;
    html: string;
  } | null;
};

/*
What actually happened to one email over the last 30 days, read off email_queue. `waiting` cannot
answer this: a candidate drops out of that count the moment it is dealt with, so a healthy zero and
an email that never ran look identical.

The window is fixed server-side and matches the card's "sent" count, so the two cannot disagree.
Anything older is a database question, not a screen one.
*/
export type EmailHistoryStatus = 'sent' | 'failed' | 'suppressed' | 'skipped' | 'expired' | 'pending';

export interface EmailHistoryRow {
  id: number;
  user_id: number;
  email: string;
  display_name: string;
  competition_id: number | null;
  /* The live name. Null once the competition is deleted - the queue row outlives it. */
  competition_name: string | null;
  /* The name the email itself carried, off template_data. Survives a delete or a rename. */
  competition_name_at_send: string | null;
  round_number: number | null;
  status: EmailHistoryStatus;
  /* When it happened - the send, the attempt, or the row being written, per status. */
  at: string;
  created_at: string;
  /* Failures only. */
  error_message: string | null;
  /* Skips only - what the operator gave as the reason. */
  reason: string | null;
}

export type EmailHistoryResponse = ApiResponse & {
  /* Every status seen in the window, whatever the filter - it is what the filter is chosen from. */
  totals?: Partial<Record<EmailHistoryStatus, number>>;
  total?: number;
  /* How far back the server looked. Fixed at 30. */
  window_days?: number;
  rows?: EmailHistoryRow[];
  truncated?: boolean;
};

/*
Today's sending against the daily allowance. `remaining_estimate` is an UPPER bound: test sends and
transactional mail (password reset, verification, contact form) leave no email_queue row, so the
real headroom is this or less. The screen labels it as an estimate for that reason.
*/
export type EmailVolumeResponse = ApiResponse & {
  daily_limit?: number;
  /* date is the Europe/London day the server counted, not one worked out from the browser clock. */
  today?: { date: string; sent: number };
  yesterday?: { date: string; sent: number };
  remaining_estimate?: number;
};

export type SendEmailsResponse = ApiResponse & {
  test_mode?: boolean;
  sent_count?: number;
  failed_count?: number;
  /* Magic send: emailed inside the last 48 hours, so marked as sent instead. Live mode only. */
  skipped_count?: number;
  candidate_count?: number;
  /* Set in test mode only - where the single copy actually went. */
  sent_to?: string | null;
};

export type BroadcastAudience = 'all' | 'competition';

export type BroadcastAudienceResponse = ApiResponse & {
  /* Who would actually be emailed, after opt-outs. */
  recipient_count?: number;
  /* The same population before opt-outs. Shown alongside so the gap is visible. */
  total_count?: number;
  opted_out_count?: number;
  /* How many go out in one press; the rest queue for later runs. */
  send_cap?: number;
  sample?: { user_id: number; display_name: string; email: string }[];
};

export type SendBroadcastResponse = ApiResponse & {
  test_mode?: boolean;
  recipient_count?: number;
  queued_count?: number;
  sent_count?: number;
  failed_count?: number;
  /* Queued but not sent in this press - waiting on a later run of /send-email. */
  pending_count?: number;
  sent_to?: string | null;
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

  /*
  Override the derived tyre-kicker judgement. Pass null to stop overriding and go back to
  trusting the rule - which is why the argument is boolean | null rather than a plain boolean.
  */
  setCompetitionStalled: async (
    competitionId: number,
    stalled: boolean | null
  ): Promise<ApiResponse & { stalled_override?: boolean | null }> => {
    const response = await api.post<ApiResponse & { stalled_override?: boolean | null }>(
      '/admin/set-competition-stalled',
      { competition_id: competitionId, stalled }
    );
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
    fixtures: FixturePair[],
    opensGameweek: boolean
  ): Promise<AddFixturesResponse> => {
    const response = await api.post<AddFixturesResponse>('/admin/add-staged-fixtures', {
      team_list_id: teamListId,
      kickoff_time: kickoffTimeIso,
      fixtures,
      opens_gameweek: opensGameweek,
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

  // ---- Fixture calendar ------------------------------------------------------------------

  // Blocks are the forward calendar. Several may exist at once for a team list - that is the
  // whole point, and the reason they are not in fixture_load, which holds only what is going out.
  getFixtureBlocks: async (teamListId: number): Promise<FixtureBlocksResponse> => {
    const response = await api.get<FixtureBlocksResponse>('/admin/get-fixture-blocks', {
      params: { team_list_id: teamListId },
    });
    return response.data;
  },

  /* No label: the server derives it from the earliest kickoff - see labelForKickoff in
     services/fixtureBlock.js. */
  addFixtureBlock: async (
    teamListId: number,
    fixtures: BlockFixtureInput[],
    opensGameweek: boolean
  ): Promise<SaveFixtureBlockResponse> => {
    const response = await api.post<SaveFixtureBlockResponse>('/admin/add-fixture-block', {
      team_list_id: teamListId,
      fixtures,
      opens_gameweek: opensGameweek,
    });
    return response.data;
  },

  // Fixtures are replaced wholesale, not merged - editing a block is re-keying it.
  updateFixtureBlock: async (
    blockId: number,
    fixtures: BlockFixtureInput[],
    opensGameweek: boolean
  ): Promise<SaveFixtureBlockResponse> => {
    const response = await api.post<SaveFixtureBlockResponse>('/admin/update-fixture-block', {
      block_id: blockId,
      fixtures,
      opens_gameweek: opensGameweek,
    });
    return response.data;
  },

  deleteFixtureBlock: async (blockId: number): Promise<ApiResponse> => {
    const response = await api.post<ApiResponse>('/admin/delete-fixture-block', {
      block_id: blockId,
    });
    return response.data;
  },

  // The handover into the existing flow: after this, push per competition on the fixtures
  // screen and then clear the batch, exactly as before.
  promoteFixtureBlock: async (blockId: number): Promise<PromoteFixtureBlockResponse> => {
    const response = await api.post<PromoteFixtureBlockResponse>('/admin/promote-fixture-block', {
      block_id: blockId,
    });
    return response.data;
  },

  // ---- Distribution ----------------------------------------------------------------------

  // Fixtures go out one competition at a time, like results. The all-competitions route is
  // gone: its only guard was an env var naming one organiser, which had to be set before testing
  // and unset after, and which starved real customers of fixtures while it was on.
  getFixturePushTargets: async (teamListId: number): Promise<FixturePushTargetsResponse> => {
    const response = await api.get<FixturePushTargetsResponse>('/admin/get-fixture-push-targets', {
      params: { team_list_id: teamListId },
    });
    return response.data;
  },

  pushFixturesToCompetition: async (competitionId: number): Promise<PushFixturesOneResponse> => {
    const response = await api.post<PushFixturesOneResponse>('/admin/push-fixtures-to-competition', {
      competition_id: competitionId,
    });
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

  // ====================================================================================
  // Emails
  // ====================================================================================

  /*
  competitionId null counts scoped emails across every competition, which is what the focus card
  wants. emailTypes narrows which emails are worked out at all, so the card can read one number
  without triggering a pass over the whole catalog.
  */
  getEmailTargets: async (
    competitionId: number | null,
    emailTypes?: string[]
  ): Promise<EmailTargetsResponse> => {
    const response = await api.post<EmailTargetsResponse>('/admin/get-email-targets', {
      competition_id: competitionId,
      email_types: emailTypes,
    });
    return response.data;
  },

  /*
  competitionId is null for platform-wide emails (Join LMS, News), and now also for a scoped email
  being previewed across every competition. The server decides which of those an email type is -
  see services/emailCatalog.js.
  */
  previewEmail: async (
    emailType: string,
    competitionId: number | null,
    /* The rendered HTML. Off from the screen - a signed-off template re-rendered on every preview
       is work nobody reads, and a test send is how you look at it again. */
    includeSample = false
  ): Promise<PreviewEmailResponse> => {
    const response = await api.post<PreviewEmailResponse>('/admin/preview-email', {
      email_type: emailType,
      competition_id: competitionId,
      include_sample: includeSample,
    });
    return response.data;
  },

  /*
  The other half of the picture: who this email HAS gone to, and when. competitionId null spans
  every competition, matching the focus card. status null returns all four.
  */
  getEmailHistory: async (
    emailType: string,
    competitionId: number | null,
    status?: EmailHistoryStatus,
    limit?: number
  ): Promise<EmailHistoryResponse> => {
    const response = await api.post<EmailHistoryResponse>('/admin/get-email-history', {
      email_type: emailType,
      competition_id: competitionId,
      status,
      limit,
    });
    return response.data;
  },

  /*
  No arguments: always the whole platform, always today. Cheap enough to run on mount, unlike the
  per-email counts, because it is one indexed pass over two days of email_queue.
  */
  getEmailVolume: async (): Promise<EmailVolumeResponse> => {
    const response = await api.post<EmailVolumeResponse>('/admin/get-email-volume', {});
    return response.data;
  },

  /*
  testMode is sent explicitly every time rather than relying on the server default. The default
  is the safe one, but a send is the last place to depend on an omission meaning what you hoped.
  */
  sendEmails: async (
    emailType: string,
    competitionId: number | null,
    testMode: boolean,
    /* The count the operator was looking at. A live send to everyone is refused with
       COUNT_CHANGED if it has moved since - ignored in test mode and when recipients are named. */
    expectedCount?: number,
    /* Send to only these, intersected server-side with who still qualifies. Ticked rows mean the
       same here as they do for markEmailsSent. */
    recipients?: { user_id: number; competition_id: number | null }[]
  ): Promise<SendEmailsResponse> => {
    const response = await api.post<SendEmailsResponse>('/admin/send-emails', {
      email_type: emailType,
      competition_id: competitionId,
      test_mode: testMode,
      expected_count: expectedCount,
      recipients,
    });
    return response.data;
  },

  /*
  Mark people as dealt with without emailing them - a 'skipped' row on email_queue, which every
  once-ever guard already excludes. Two grains: pass recipients to mark only those, or omit it and
  pass expectedCount to mark everyone waiting.
  */
  markEmailsSent: async (
    emailType: string,
    competitionId: number | null,
    opts: {
      recipients?: { user_id: number; competition_id: number | null }[];
      expectedCount?: number;
      reason?: string;
    }
  ): Promise<MarkEmailsSentResponse> => {
    const response = await api.post<MarkEmailsSentResponse>('/admin/mark-emails-sent', {
      email_type: emailType,
      competition_id: competitionId,
      recipients: opts.recipients,
      expected_count: opts.expectedCount,
      reason: opts.reason,
    });
    return response.data;
  },

  // ====================================================================================
  // Broadcast
  //
  // Its own pair of routes rather than the catalog's: a broadcast carries text somebody typed and
  // can reach every account, so it has an audience count and a confirmation the template emails
  // do not need. See routes/admin/send-broadcast.js.
  // ====================================================================================

  broadcastAudience: async (
    audience: BroadcastAudience,
    competitionId: number | null
  ): Promise<BroadcastAudienceResponse> => {
    const response = await api.post<BroadcastAudienceResponse>('/admin/broadcast-audience', {
      audience,
      competition_id: competitionId,
    });
    return response.data;
  },

  /*
  confirmCount is the number the operator was actually looking at when they pressed send. The
  server refuses if the audience has moved since - see COUNT_CHANGED. Ignored in test mode.
  */
  sendBroadcast: async (params: {
    audience: BroadcastAudience;
    competitionId: number | null;
    subject: string;
    message: string;
    testMode: boolean;
    confirmCount: number | null;
  }): Promise<SendBroadcastResponse> => {
    const response = await api.post<SendBroadcastResponse>('/admin/send-broadcast', {
      audience: params.audience,
      competition_id: params.competitionId,
      subject: params.subject,
      message: params.message,
      test_mode: params.testMode,
      confirm_count: params.confirmCount,
    });
    return response.data;
  },
};

export default api;
