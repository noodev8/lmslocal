/**
 * Round state machine.
 *
 * The organiser's fixtures and results are one screen, not two, and what it shows is derived
 * here rather than in the component. The rules — phases, the scenario matrix, the copy table and
 * the open questions — live in docs/round-state-machine.md. **That doc is the contract**: change
 * it first, then change this file to match. Nothing in here should be a rule you can't find
 * written down there.
 *
 * Deliberately pure: no React, no fetching, no clock. `now` is passed in so a phase can be
 * checked at any instant without waiting for one.
 */

/* ---------------------------------------------------------------------------------------------
 * Phases
 * ------------------------------------------------------------------------------------------- */

export type RoundPhase =
  /** No round exists yet. */
  | 'NO_ROUND'
  /** Fixtures published, picks still open. */
  | 'OPEN'
  /** Picks shut, matches in play, no results yet. */
  | 'LOCKED'
  /** Some results in, not all. */
  | 'RESULTS_PARTIAL'
  /** Every result in, eliminations not yet applied. */
  | 'RESULTS_READY'
  /** Every fixture processed — the round is settled. */
  | 'COMPLETE'
  /** The competition itself has finished. Beats every other phase. */
  | 'COMPETITION_COMPLETE';

/* ---------------------------------------------------------------------------------------------
 * Inputs
 * ------------------------------------------------------------------------------------------- */

/**
 * The fields of a fixture the machine actually reads.
 *
 * Note the shapes, which are not the obvious ones:
 * - `result` is a team short code or the literal string 'DRAW' — never 'home_win'/'away_win'.
 *   That vocabulary belongs to the result buttons and is converted at the UI boundary.
 * - `processed` is a timestamp or null, not a boolean.
 */
export interface RoundFixtureInput {
  result: string | null;
  processed: string | null;
}

export interface RoundSnapshot {
  /** False when the fixtures route answered NO_ROUNDS. */
  hasRound: boolean;
  roundNumber: number | null;
  /** `round.lock_time`. Doubles as kickoff — one per round, shared by every fixture. */
  lockTime: string | null;
  fixtures: RoundFixtureInput[];
  /** `competition.fixture_service === true`. */
  automated: boolean;
  /**
   * `competition.ready_at !== null` — the organiser has said they're ready to start.
   *
   * Only read in NO_ROUND, and only when automated. NO_ROUND is unreachable once round 1 exists
   * (between rounds the phase is COMPLETE), so this has exactly one moment to matter: before the
   * competition's first round. Defaults true so nothing that doesn't know about it changes.
   */
  readyToStart?: boolean;
  /** `competition.is_complete`. */
  competitionComplete: boolean;
  now: Date;
}

/** Who is looking. Permissions never affect the phase — only what they may do about it. */
export interface RoundPermissions {
  canManageFixtures: boolean;
  canManageResults: boolean;
}

/* ---------------------------------------------------------------------------------------------
 * Derived state
 * ------------------------------------------------------------------------------------------- */

export interface RoundState {
  phase: RoundPhase;
  roundNumber: number | null;
  lockTime: Date | null;
  isLocked: boolean;
  totalFixtures: number;
  resultsIn: number;
  processedCount: number;
  automated: boolean;
  readyToStart: boolean;
}

export function deriveRoundState(snapshot: RoundSnapshot): RoundState {
  const { hasRound, roundNumber, fixtures, automated, competitionComplete, now } = snapshot;
  const readyToStart = snapshot.readyToStart !== false;

  // An unparseable timestamp is treated as no lock time at all. Date rejects some real-world
  // shapes — notably Postgres's own '...+00' text rendering — and the failure mode without this
  // is a literal "Locks Invalid Date" on the organiser's dashboard.
  const lockTime = parseTimestamp(snapshot.lockTime);
  const totalFixtures = fixtures.length;
  const resultsIn = fixtures.filter((f) => f.result !== null).length;
  const processedCount = fixtures.filter((f) => f.processed !== null).length;

  // A round with no lock time counts as locked. Matches the behaviour the results screen has
  // always had, and it's the safer reading: a round nobody is waiting on isn't one still open
  // for picks.
  const isLocked = lockTime === null || now >= lockTime;

  const base: Omit<RoundState, 'phase'> = {
    roundNumber: hasRound ? roundNumber : null,
    lockTime,
    isLocked,
    totalFixtures,
    resultsIn,
    processedCount,
    automated,
    readyToStart,
  };

  return { ...base, phase: derivePhase({ hasRound, competitionComplete, isLocked, totalFixtures, resultsIn, processedCount }) };
}

/**
 * The dashboard's view of the same machine, built from counts instead of rows.
 *
 * `/get-user-dashboard` carries no fixture rows — it would be a large payload for a screen that
 * only needs a subtitle — but it does carry `total_fixtures`, `fixtures_with_results` and
 * `fixtures_processed` for the current round. Those three are enough to reach every phase, so the
 * tile no longer degrades. It used to stop at LOCKED, which was survivable while the copy said
 * "In play" (true at every point past the lock) and became a lie the moment the tile started
 * prompting "Enter results" — it went on saying it after every result was in and processed.
 *
 * The counts are expanded into placeholder rows so there is exactly one implementation of the
 * phase rules. A row's identity is never used, only whether its result and processed are set.
 */
export function deriveDashboardRoundState(input: {
  currentRound: number | null | undefined;
  currentRoundLockTime: string | null | undefined;
  automated: boolean;
  readyToStart?: boolean;
  competitionComplete: boolean;
  now: Date;
  totalFixtures?: number | null;
  fixturesWithResults?: number | null;
  fixturesProcessed?: number | null;
}): RoundState {
  const total = Math.max(0, input.totalFixtures ?? 0);
  // Clamped so a payload that disagrees with itself can't produce a phase the machine never
  // intended - more results than fixtures would read as RESULTS_READY on an empty round.
  const withResults = Math.min(Math.max(0, input.fixturesWithResults ?? 0), total);
  const processed = Math.min(Math.max(0, input.fixturesProcessed ?? 0), withResults);

  const fixtures: RoundFixtureInput[] = Array.from({ length: total }, (_, i) => ({
    result: i < withResults ? 'PLACEHOLDER' : null,
    processed: i < processed ? 'PLACEHOLDER' : null,
  }));

  return deriveRoundState({
    hasRound: !!input.currentRound && input.currentRound > 0,
    roundNumber: input.currentRound ?? null,
    lockTime: input.currentRoundLockTime ?? null,
    fixtures,
    automated: input.automated,
    readyToStart: input.readyToStart,
    competitionComplete: input.competitionComplete,
    now: input.now,
  });
}

function parseTimestamp(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function derivePhase(input: {
  hasRound: boolean;
  competitionComplete: boolean;
  isLocked: boolean;
  totalFixtures: number;
  resultsIn: number;
  processedCount: number;
}): RoundPhase {
  const { hasRound, competitionComplete, isLocked, totalFixtures, resultsIn, processedCount } = input;

  // Wins over everything: once there's a winner, no round is still in progress.
  if (competitionComplete) return 'COMPETITION_COMPLETE';

  if (!hasRound) return 'NO_ROUND';

  // Before the empty-round guard, not after: the dashboard derives a phase with no fixture rows
  // at all (deriveDashboardRoundState), so testing emptiness first would report every round as
  // LOCKED and OPEN would become unreachable there.
  if (!isLocked) return 'OPEN';

  // A round carrying no fixtures is one still waiting for them, not one that's finished. Without
  // this guard the "everything processed" test below is vacuously true and reports COMPLETE.
  if (totalFixtures === 0) return 'LOCKED';

  if (processedCount === totalFixtures) return 'COMPLETE';

  if (resultsIn === 0) return 'LOCKED';

  if (resultsIn === totalFixtures) return 'RESULTS_READY';

  return 'RESULTS_PARTIAL';
}

/* ---------------------------------------------------------------------------------------------
 * Capabilities
 * ------------------------------------------------------------------------------------------- */

export interface RoundCapabilities {
  /** Show the "add fixtures" path. */
  canEditFixtures: boolean;
  /** Draw the three-way result row under each fixture at all. */
  showResultSlots: boolean;
  /** Those slots are clickable rather than a read-out. */
  canEnterResults: boolean;
  /** Offer "Process results". */
  canProcessResults: boolean;
}

export function deriveRoundCapabilities(
  state: RoundState,
  permissions: RoundPermissions,
  fixtures: RoundFixtureInput[]
): RoundCapabilities {
  const { phase, automated } = state;
  const { canManageFixtures, canManageResults } = permissions;

  const finished = phase === 'COMPETITION_COMPLETE';

  // NO_ROUND starts the competition's first round; COMPLETE starts the next one, and is the only
  // route from one week to the next on a manual competition. organizer-add-fixtures refuses only
  // while the latest round still has unprocessed fixtures (PREVIOUS_ROUND_INCOMPLETE) and creates
  // round N+1 itself otherwise - so the phases where it succeeds are exactly these two. Every
  // other phase is still excluded, which is what the ROUND_HAS_FIXTURES guard is about.
  const canEditFixtures =
    canManageFixtures && !automated && (phase === 'NO_ROUND' || phase === 'COMPLETE') && !finished;

  // Absent before kickoff, not disabled. A wall of greyed-out result buttons on a round that
  // hasn't started reads as broken software — it was the single worst thing about the screen this
  // one replaces.
  const showResultSlots =
    phase === 'LOCKED' || phase === 'RESULTS_PARTIAL' || phase === 'RESULTS_READY' || phase === 'COMPLETE';

  const canEnterResults = showResultSlots && canManageResults && !automated && phase !== 'COMPLETE' && !finished;

  // Keyed off saved state rather than anything clicked this session, so the action survives a
  // reload. The fixture service sets result and processed in the same push, so an automated
  // competition never has anything of its own to process.
  const hasUnprocessedResult = fixtures.some((f) => f.result !== null && f.processed === null);
  const canProcessResults = canManageResults && !automated && hasUnprocessedResult && !finished;

  return { canEditFixtures, showResultSlots, canEnterResults, canProcessResults };
}

/* ---------------------------------------------------------------------------------------------
 * Copy
 *
 * The tile and the page draw from the same source so the dashboard can never disagree with the
 * screen it links to. Wording rules are in docs/design-system.md: "you" is the organiser, and an
 * opt-in feature is never described as universal — which is why the automated lines are only ever
 * reachable when `automated` is true.
 * ------------------------------------------------------------------------------------------- */

/** Who is looking at the tile. Absent on surfaces that have no permissions to hand. */
export interface RoundTileViewer {
  canManageResults?: boolean;
  canManageFixtures?: boolean;
}

/**
 * Whether the competition is waiting on the viewer rather than on the players or the clock.
 *
 * Two jobs, two permissions. Results phases need `canManageResults`; the phases where a round can
 * be created - no round yet, or the last one settled - need `canManageFixtures`, and mirror
 * `canEditFixtures` exactly. Between rounds nothing moves until the organiser acts, which is the
 * definition of waiting on them.
 *
 * Only ever true on a manual competition: the fixture service publishes fixtures and processes
 * results itself, so an automated round is never owed anything by a person. Drives both the
 * wording below and the tile's accent, so the two can't disagree.
 *
 * The start gate is the one thing an automated competition does owe its organiser, and it is
 * deliberately NOT here - it has its own card with its own button (see isStartGateVisible), and a
 * red tile underneath a red card is two alarms for one job.
 */
export function roundTileNeedsAction(state: RoundState, viewer: RoundTileViewer = {}): boolean {
  if (state.automated) return false;

  switch (state.phase) {
    case 'NO_ROUND':
    case 'COMPLETE':
      return !!viewer.canManageFixtures;
    case 'LOCKED':
    case 'RESULTS_PARTIAL':
    case 'RESULTS_READY':
      return !!viewer.canManageResults;
    default:
      return false;
  }
}

/**
 * Where the tile should go: the round screen, or straight to the fixture entry form.
 *
 * A tile that says "Add next matches" and lands on a read-only page of last week's results makes
 * the organiser find the button themselves, on a screen that looks like it's about something
 * else. When the tile names a job, it goes where the job is done.
 *
 * Returns a role rather than a URL so the routing table stays in the app and the rule stays here.
 * `'fixtures'` is only ever returned in the two phases where `canEditFixtures` is also true, so
 * the form can never be reached at a point where it would refuse the submission.
 */
export function roundTileTarget(state: RoundState, viewer: RoundTileViewer = {}): 'round' | 'fixtures' {
  if (!roundTileNeedsAction(state, viewer)) return 'round';
  return state.phase === 'NO_ROUND' || state.phase === 'COMPLETE' ? 'fixtures' : 'round';
}

/**
 * Whether to draw the start gate — the card that asks an automated competition's organiser to
 * press Ready, and afterwards tells them when their first round lands.
 *
 * One rule read by two screens: the competition dashboard, where the button actually lives, and
 * the round screen, which would otherwise be an empty page saying nothing is happening. Pressing
 * Ready is a single act on a competition that cannot move without it, so it is answered where the
 * organiser already is rather than one navigation away.
 *
 * True in both faces of the gate — before Ready (the button) and after (the date) — because the
 * question "when does this start?" is worth answering either way. `readyToStart` picks the face.
 */
export function isStartGateVisible(state: RoundState, viewer: RoundTileViewer = {}): boolean {
  return state.automated && state.phase === 'NO_ROUND' && !!viewer.canManageFixtures;
}

/**
 * Short form for the dashboard tile, under the round number.
 *
 * `startsAt` is the kickoff their first round would get, from get-competition-start-outlook. It is
 * passed in rather than derived because it depends on what is staged for their team list, which
 * the machine cannot see. Optional: without it the tile falls back to stating the condition, which
 * is what it said before and still true.
 */
export function roundTileSummary(
  state: RoundState,
  viewer: RoundTileViewer = {},
  startsAt: string | null = null
): string {
  // The organiser of a manual competition is told the job, not the condition. "In play" is a
  // true description of a locked round and useless to the one person who has to act on it - and
  // this tile is the only route to the result buttons. See docs/round-state-machine.md §5.
  const needsAction = roundTileNeedsAction(state, viewer);

  switch (state.phase) {
    case 'COMPETITION_COMPLETE':
      return 'Finished';
    case 'NO_ROUND':
      // The start gate card above carries the prompt and the button, so the tile states the
      // condition plainly and stays out of its way. Once they are ready the card removes itself
      // and this tile is the only thing left on the dashboard describing the competition - so it
      // has to carry the date, not "waiting for matches". We know when round 1 starts; a tile
      // still saying we're waiting reads as though pressing Ready did nothing.
      if (state.automated) {
        if (!state.readyToStart) return 'Not started yet';
        const started = formatTileStart(startsAt);
        return started ? `Starts ${started}` : 'Waiting for matches';
      }
      return needsAction ? 'Add matches' : 'No matches yet';
    case 'OPEN':
      // No lock time here even though we have one. An organiser who plays sees this tile beside
      // the Play tile, and the deadline is the player's concern - it lives there, via
      // pickDeadlineText. This tile answers "what do I owe this round?", and in OPEN that's
      // nothing. See docs/round-state-machine.md §5.
      return 'Open for picks';
    case 'LOCKED':
      return needsAction ? 'Enter results' : 'In play';
    case 'RESULTS_PARTIAL':
      return needsAction
        ? `${state.resultsIn} of ${state.totalFixtures} — enter the rest`
        : `${state.resultsIn} of ${state.totalFixtures} results in`;
    case 'RESULTS_READY':
      return needsAction ? 'Process the round' : 'All results in';
    case 'COMPLETE':
      // "Add next fixtures" rather than "Complete" for the one person who can act on it. A
      // settled round is a finished fact for everyone else, but for the organiser it is the
      // moment the competition stalls: nothing moves again until next week's fixtures exist, and
      // the tile is where they look. The label beside it still says which round settled.
      if (needsAction) return 'Add next matches';
      // Not "Round 3 complete" — the tile's own label already says which round, and the pair
      // renders as "Round 3 / Round 3 complete".
      return 'Complete';
  }
}

/** Long form for the round page, under the heading. */
export function roundStatusLine(state: RoundState): string {
  switch (state.phase) {
    case 'COMPETITION_COMPLETE':
      return 'This competition has finished.';
    case 'NO_ROUND':
      if (!state.automated) return "Add this round's matches to get started.";
      // No date here even when we have one. The date comes from the server (see
      // /get-competition-start-outlook) and belongs to the card that can show all three answers -
      // this line is the machine's own, and the machine doesn't know what's staged.
      return state.readyToStart
        ? 'Your first round starts with the next set of matches.'
        : "Start your competition when you've invited your players.";
    case 'OPEN':
      return state.lockTime ? `Picks close ${formatLong(state.lockTime)}.` : 'Picks are open.';
    case 'LOCKED':
      return state.automated
        ? 'Picks are locked. Results come in automatically.'
        : 'Picks are locked.';
    case 'RESULTS_PARTIAL':
      return `${state.resultsIn} of ${state.totalFixtures} results in.`;
    case 'RESULTS_READY':
      return state.automated
        ? 'Every result is in.'
        : 'Every result is in — process the round to settle it.';
    case 'COMPLETE':
      return state.roundNumber ? `Round ${state.roundNumber} is settled.` : 'This round is settled.';
  }
}

/**
 * The tile's own label — "Round 3", or a plain fallback before any round exists.
 *
 * When the tile is asking for fixtures it names the round being *created*, not the one that just
 * finished: "Round 1 / Add next fixtures" pairs a settled round with a job belonging to the next
 * one, and reads as an invitation to add fixtures to round 1. The round about to exist is
 * `roundNumber + 1`, or round 1 when there is no round at all.
 */
export function roundTileLabel(state: RoundState, viewer: RoundTileViewer = {}): string {
  if (roundTileNeedsAction(state, viewer)) {
    if (state.phase === 'NO_ROUND') return 'Round 1';
    if (state.phase === 'COMPLETE') return `Round ${(state.roundNumber ?? 0) + 1}`;
  }
  return state.roundNumber ? `Round ${state.roundNumber}` : 'Round';
}

/**
 * What the start gate says when the organiser cannot press Ready yet.
 *
 * Ready only ever means "start me on the round I can see" — it is not a standing order, because a
 * button that appears to work while quietly deferring is worse than one that says why not. An
 * organiser knows their own gameweeks and can come back; what they cannot do is act on a promise
 * with no date in it.
 *
 * Two refusals, and the difference is whether we have a date at all. A staged batch they cannot
 * have (mid-gameweek, or inside the 48-hour lead time) carries its kickoff, so we can name it and
 * send them back after it. An empty staging table carries nothing — the next batch arrives when it
 * is entered by hand — so we say there is nothing for them yet and promise no date.
 */
export function startBlockedText(currentBatchKickoff: string | null): string {
  const kickoff = currentBatchKickoff ? parseTimestamp(currentBatchKickoff) : null;
  if (!kickoff) {
    return "There are no matches ready for you at the moment. As soon as the next set is in, you can start your competition on it.";
  }

  // Tense follows the clock. The same block covers a batch that hasn't started (staged mid-gameweek,
  // or inside the lead time) and one that already has, and "they kick off last Friday" is the kind
  // of wrong that makes an organiser distrust every other date on the screen.
  const started = kickoff.getTime() <= Date.now();
  const when = `${started ? 'They kicked off' : 'They kick off'} ${formatLong(kickoff)}`;

  return `The current matches are already under way. ${when}. Come back once they're done and you can start on the next round.`;
}

/**
 * The warning shown to a player who still owes a pick — the Play tile's second line, and the
 * dashboard card's pick row. Carries the deadline because these are the places where it's
 * actionable; the Round tile beside the Play tile states the phase instead.
 *
 * Falls back to the bare warning when there's no lock time to quote, which is the same thing the
 * tile said before and still true.
 */
export function pickDeadlineText(state: RoundState): string {
  if (state.phase !== 'OPEN' || !state.lockTime) return 'Pick needed';
  return `Pick needed by ${formatShort(state.lockTime)}`;
}

/**
 * Kickoff times are UK kickoff times, so they are always shown in UK time — never the viewer's
 * local zone. An organiser checking the app from Spain still needs to read the time Arsenal
 * actually kick off, and a player who sees "9pm" when the pub says "8pm" has been given wrong
 * information, not a localised one.
 *
 * Stored values are correct UTC instants (the server converts entered UK wall-clock times via
 * Europe/London before writing), so this is purely a rendering choice. Handles BST and GMT on its
 * own. Revisit only if the product ever runs outside the UK.
 */
const DISPLAY_TIME_ZONE = 'Europe/London';

/**
 * 12-hour throughout: kickoffs are spoken as "half seven", not "19:30", and the fixture entry
 * form offers its shortcuts the same way. `hour12` gives "7:30 pm" — the space is closed up so
 * this matches the `7:30pm` form used on the pick and fixture screens. The class covers the
 * narrow no-break space some engines emit in place of a plain one.
 *
 * On the hour loses its minutes: nobody says "eight o'clock pee em" as "8:00pm", and most kickoffs
 * land on the hour, so the zeros were the commonest thing on these screens.
 */
const TIME_PARTS = { hour: 'numeric', minute: '2-digit', hour12: true } as const;

function closeUpMeridiem(text: string): string {
  return text.replace(/:00(?=\s*[ap]m\b)/gi, '').replace(/\s(?=[ap]m\b)/gi, '');
}

/**
 * "Fri, 8pm" for a deadline this side of a week, "Fri 21 Aug, 8pm" for anything further out.
 *
 * A bare weekday only identifies a day within the next six: on the 7th, "Friday" reads as the 14th,
 * and a deadline on the 21st shown that way is not ambiguous — it is wrong, and it is wrong in the
 * direction that makes a player think they have a week less than they do. Six rather than seven
 * because a deadline exactly a week out shares today's weekday name.
 */
const WEEKDAY_ALONE_IS_CLEAR_MS = 6 * 24 * 60 * 60 * 1000;

function formatShort(date: Date, reference: Date = new Date()): string {
  const withinTheWeek = date.getTime() - reference.getTime() < WEEKDAY_ALONE_IS_CLEAR_MS;

  return closeUpMeridiem(
    date.toLocaleString('en-GB', {
      timeZone: DISPLAY_TIME_ZONE,
      weekday: 'short',
      ...(withinTheWeek ? {} : { day: 'numeric', month: 'short' }),
      ...TIME_PARTS,
    })
  );
}

/**
 * A kickoff time as an organiser would say it out loud — "Saturday 15 March, 3pm".
 *
 * Exported for the start card, which gets its date from the server rather than from the machine.
 * It goes through here so every kickoff on the screen obeys the same UK-time rule.
 */
export function formatRoundStart(timestamp: string): string | null {
  const parsed = parseTimestamp(timestamp);
  return parsed ? formatLong(parsed) : null;
}

/**
 * Tile-sized: "Fri 21 Aug, 8pm". Carries the date as well as the weekday because a first round can
 * be a fortnight out, where a bare "Fri" says nothing useful.
 */
function formatTileStart(timestamp: string | null): string | null {
  const parsed = timestamp ? parseTimestamp(timestamp) : null;
  if (!parsed) return null;

  return closeUpMeridiem(
    parsed.toLocaleString('en-GB', {
      timeZone: DISPLAY_TIME_ZONE,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...TIME_PARTS,
    })
  );
}

function formatLong(date: Date): string {
  return closeUpMeridiem(
    date.toLocaleString('en-GB', {
      timeZone: DISPLAY_TIME_ZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...TIME_PARTS,
    })
  );
}

/* ---------------------------------------------------------------------------------------------
 * Result vocabulary
 *
 * The database stores a winning team's short code or 'DRAW'; the result buttons speak in
 * home/away/draw. Converting in one place keeps that mismatch from spreading.
 * ------------------------------------------------------------------------------------------- */

export type ResultOutcome = 'home_win' | 'away_win' | 'draw';

export function outcomeFromResult(
  result: string | null,
  homeTeamShort: string,
  awayTeamShort: string
): ResultOutcome | null {
  if (!result) return null;
  if (result === 'DRAW') return 'draw';
  if (result === homeTeamShort) return 'home_win';
  if (result === awayTeamShort) return 'away_win';
  return null;
}
