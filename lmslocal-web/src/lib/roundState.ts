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
}

export function deriveRoundState(snapshot: RoundSnapshot): RoundState {
  const { hasRound, roundNumber, fixtures, automated, competitionComplete, now } = snapshot;

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
  };

  return { ...base, phase: derivePhase({ hasRound, competitionComplete, isLocked, totalFixtures, resultsIn, processedCount }) };
}

/**
 * The dashboard's cut-down view of the same machine.
 *
 * `/get-user-dashboard` carries the round number and its lock time but no fixture rows, so the
 * tile can reach OPEN / LOCKED / COMPETITION_COMPLETE but can never distinguish "in play" from
 * "3 of 10 results in" — it has nothing to count. That's the deliberate trade in
 * docs/round-state-machine.md §8: the tile states the phase, the round page states the detail,
 * and the dashboard costs no extra request. It degrades to "In play", which is true at every
 * point it's shown, rather than guessing.
 *
 * Add `fixtures_with_results` / `total_fixtures` to the dashboard payload if the counts ever need
 * to appear on the tile.
 */
export function deriveDashboardRoundState(input: {
  currentRound: number | null | undefined;
  currentRoundLockTime: string | null | undefined;
  automated: boolean;
  competitionComplete: boolean;
  now: Date;
}): RoundState {
  return deriveRoundState({
    hasRound: !!input.currentRound && input.currentRound > 0,
    roundNumber: input.currentRound ?? null,
    lockTime: input.currentRoundLockTime ?? null,
    fixtures: [],
    automated: input.automated,
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

  // Only offered when there is no round at all. The backend refuses to add fixtures to a round
  // that already has them (ROUND_HAS_FIXTURES), so showing the button later would buy nothing but
  // an error message.
  const canEditFixtures = canManageFixtures && !automated && phase === 'NO_ROUND' && !finished;

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

/** Short form for the dashboard tile, under the round number. */
export function roundTileSummary(state: RoundState): string {
  switch (state.phase) {
    case 'COMPETITION_COMPLETE':
      return 'Finished';
    case 'NO_ROUND':
      return state.automated ? 'Waiting for fixtures' : 'No fixtures yet';
    case 'OPEN':
      // No lock time here even though we have one. An organiser who plays sees this tile beside
      // the Play tile, and the deadline is the player's concern - it lives there, via
      // pickDeadlineText. This tile answers "what do I owe this round?", and in OPEN that's
      // nothing. See docs/round-state-machine.md §5.
      return 'Open for picks';
    case 'LOCKED':
      return 'In play';
    case 'RESULTS_PARTIAL':
      return `${state.resultsIn} of ${state.totalFixtures} results in`;
    case 'RESULTS_READY':
      return 'All results in';
    case 'COMPLETE':
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
      return state.automated
        ? "Fixtures for the next round haven't been published yet."
        : "Add this round's fixtures to get started.";
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

/** The tile's own label — "Round 3", or a plain fallback before any round exists. */
export function roundTileLabel(state: RoundState): string {
  return state.roundNumber ? `Round ${state.roundNumber}` : 'Round';
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
 */
const TIME_PARTS = { hour: 'numeric', minute: '2-digit', hour12: true } as const;

function closeUpMeridiem(text: string): string {
  return text.replace(/\s(?=[ap]m\b)/gi, '');
}

function formatShort(date: Date): string {
  return closeUpMeridiem(
    date.toLocaleString('en-GB', {
      timeZone: DISPLAY_TIME_ZONE,
      weekday: 'short',
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
