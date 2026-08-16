import 'package:intl/intl.dart';

/// The round state machine, ported from `lmslocal-web/src/lib/roundState.ts`.
///
/// The rules — phases, the scenario matrix, the copy table — live in
/// `docs/round-state-machine.md`. **That doc is the contract**: change it
/// first, then change this file and its web twin to match. Nothing in here
/// should be a rule you cannot find written down there.
///
/// Deliberately pure: no widgets, no fetching, no clock. `now` is passed in so
/// a phase can be checked at any instant without waiting for one.
///
/// **Two deliberate divergences from the web**, both from §4 of
/// `docs/flutter-migration.md`:
///
/// 1. Only the phases and the player-facing copy are ported. The organiser
///    lines — "Add matches", "Process the round", the start gate — have no
///    reader here; this app is player-only.
/// 2. "You" is the player, not the organiser.
///
/// **And one that is not deliberate.** The web pins every kickoff to
/// Europe/London, because a UK kickoff time is wrong information in any other
/// zone. Dart cannot do that without the `timezone` package, so times here are
/// rendered in the device's own zone — correct for a player in the UK, an hour
/// out for one abroad. Tracked in `docs/flutter-migration.md`.
enum RoundPhase {
  /// No round exists yet.
  noRound,

  /// Fixtures published, picks still open.
  open,

  /// Picks shut, matches in play, no results yet.
  locked,

  /// Some results in, not all.
  resultsPartial,

  /// Every result in, eliminations not yet applied.
  resultsReady,

  /// Every fixture processed — the round is settled.
  complete,

  /// The competition itself has finished. Beats every other phase.
  competitionComplete,
}

class RoundState {
  const RoundState({
    required this.phase,
    required this.roundNumber,
    required this.lockTime,
    required this.isLocked,
    required this.totalFixtures,
    required this.resultsIn,
    required this.processedCount,
  });

  final RoundPhase phase;
  final int? roundNumber;
  final DateTime? lockTime;
  final bool isLocked;
  final int totalFixtures;
  final int resultsIn;
  final int processedCount;
}

/// The dashboard's view of the machine, built from counts instead of rows.
///
/// `/get-user-dashboard` carries no fixture rows — it would be a large payload
/// for a screen that only needs a subtitle — but it does carry
/// `total_fixtures`, `fixtures_with_results` and `fixtures_processed` for the
/// current round. Those three are enough to reach every phase.
///
/// The counts are expanded into placeholder rows so there is exactly one
/// implementation of the phase rules, matching the web line for line. A row's
/// identity is never used, only whether its result and processed are set.
RoundState deriveDashboardRoundState({
  required int? currentRound,
  required DateTime? currentRoundLockTime,
  required bool competitionComplete,
  required DateTime now,
  int? totalFixtures,
  int? fixturesWithResults,
  int? fixturesProcessed,
}) {
  final total = (totalFixtures ?? 0).clamp(0, 1 << 30);
  // Clamped so a payload that disagrees with itself cannot produce a phase the
  // machine never intended — more results than fixtures would read as
  // resultsReady on an empty round.
  final withResults = (fixturesWithResults ?? 0).clamp(0, total);
  final processed = (fixturesProcessed ?? 0).clamp(0, withResults);

  final hasRound = currentRound != null && currentRound > 0;

  // A round with no lock time counts as locked. It is the safer reading: a
  // round nobody is waiting on is not one still open for picks.
  final isLocked =
      currentRoundLockTime == null || !now.isBefore(currentRoundLockTime);

  return RoundState(
    phase: _derivePhase(
      hasRound: hasRound,
      competitionComplete: competitionComplete,
      isLocked: isLocked,
      totalFixtures: total,
      resultsIn: withResults,
      processedCount: processed,
    ),
    roundNumber: hasRound ? currentRound : null,
    lockTime: currentRoundLockTime,
    isLocked: isLocked,
    totalFixtures: total,
    resultsIn: withResults,
    processedCount: processed,
  );
}

RoundPhase _derivePhase({
  required bool hasRound,
  required bool competitionComplete,
  required bool isLocked,
  required int totalFixtures,
  required int resultsIn,
  required int processedCount,
}) {
  // Wins over everything: once there is a winner, no round is still in
  // progress.
  if (competitionComplete) return RoundPhase.competitionComplete;

  if (!hasRound) return RoundPhase.noRound;

  // Before the empty-round guard, not after: a phase is derived here with no
  // fixture counts at all, so testing emptiness first would report every round
  // as locked and `open` would become unreachable.
  if (!isLocked) return RoundPhase.open;

  // A round carrying no fixtures is one still waiting for them, not one that
  // has finished. Without this guard the "everything processed" test below is
  // vacuously true and reports complete.
  if (totalFixtures == 0) return RoundPhase.locked;

  if (processedCount == totalFixtures) return RoundPhase.complete;

  if (resultsIn == 0) return RoundPhase.locked;

  if (resultsIn == totalFixtures) return RoundPhase.resultsReady;

  return RoundPhase.resultsPartial;
}

/// Whether anyone can still join — round 1's lock time, never `status`, which
/// lags behind it (docs/player-onboarding.md §4.2).
///
/// The Dart half of `joiningOpen` in lmslocal-web/src/lib/roundState.ts; keep
/// the two in step. Everyone has to start together, so joining closes the
/// moment round 1 locks: a late entrant would face opponents who had already
/// burned teams.
bool joiningOpen({
  required int? currentRound,
  required DateTime? currentRoundLockTime,
  DateTime? now,
}) {
  if (currentRound == null || currentRound < 1) return true; // no rounds yet
  if (currentRound > 1) return false;
  if (currentRoundLockTime == null) return true;
  return currentRoundLockTime.isAfter(now ?? DateTime.now());
}

/* -----------------------------------------------------------------------------------------------
 * Copy
 *
 * The dashboard card and the game screen draw from here, so the two can never
 * disagree about the same round.
 * -------------------------------------------------------------------------------------------- */

/// The warning shown to a player who still owes a pick.
///
/// Carries the deadline because the places that show it — the dashboard card,
/// the Play tile — are the places where it is actionable. Falls back to the
/// bare warning when there is no lock time to quote.
String pickDeadlineText(RoundState state) {
  if (state.phase != RoundPhase.open || state.lockTime == null) {
    return 'Pick needed';
  }
  return 'Pick needed by ${formatShort(state.lockTime!)}';
}

/// One line saying where the round has got to, in the player's voice.
///
/// The web's equivalent is `roundStatusLine`, which speaks to the organiser and
/// names jobs — "process the round", "add this round's matches". A player has
/// no job here beyond picking, so every phase past the lock states what is
/// happening rather than what is owed.
String playerRoundStatus(RoundState state) {
  switch (state.phase) {
    case RoundPhase.competitionComplete:
      return 'This competition has finished.';
    case RoundPhase.noRound:
      return 'Waiting for the first round of matches.';
    case RoundPhase.open:
      return state.lockTime == null
          ? 'Picks are open.'
          : 'Picks close ${formatLong(state.lockTime!)}.';
    case RoundPhase.locked:
      // States what happened to the window, not how many picked. Counting
      // invites a claim the numbers cannot back — a round can lock with picks
      // missing. This is true either way.
      return 'Picks are in — the window is closed.';
    case RoundPhase.resultsPartial:
      return '${state.resultsIn} of ${state.totalFixtures} results in.';
    case RoundPhase.resultsReady:
      return 'Every result is in.';
    case RoundPhase.complete:
      return state.roundNumber != null
          ? 'Round ${state.roundNumber} is settled.'
          : 'This round is settled.';
  }
}

/// The heading above the still-in count.
///
/// "After round 1" between rounds, not "Round 1". The count is current and the
/// round is finished, so heading a live figure with a settled round's number
/// reads as a snapshot taken back then.
String roundHeading(RoundState state) {
  if (state.roundNumber == null) return 'Not started';
  return state.phase == RoundPhase.complete
      ? 'After round ${state.roundNumber}'
      : 'Round ${state.roundNumber}';
}

/* -----------------------------------------------------------------------------------------------
 * Dates
 *
 * 12-hour throughout: kickoffs are spoken as "half seven", not "19:30". On the
 * hour loses its minutes — nobody says "eight o'clock pee em" as "8:00pm", and
 * most kickoffs land on the hour.
 * -------------------------------------------------------------------------------------------- */

/// A bare weekday only identifies a day within the next six: on the 7th,
/// "Friday" reads as the 14th, and a deadline on the 21st shown that way is not
/// ambiguous — it is wrong, in the direction that makes a player think they
/// have a week less than they do.
const Duration _weekdayAloneIsClear = Duration(days: 6);

/// "Fri, 8pm" for a deadline this side of a week, "Fri 21 Aug, 8pm" further out.
String formatShort(DateTime time, {DateTime? reference}) {
  final local = time.toLocal();
  final from = reference ?? DateTime.now();
  final withinTheWeek = local.difference(from) < _weekdayAloneIsClear;

  final date = DateFormat(withinTheWeek ? 'EEE' : 'EEE d MMM').format(local);
  return '$date, ${_time(local)}';
}

/// A kickoff as a player would say it out loud — "Saturday 15 March, 3pm".
String formatLong(DateTime time) {
  final local = time.toLocal();
  return '${DateFormat('EEEE d MMMM').format(local)}, ${_time(local)}';
}

String _time(DateTime local) {
  final pattern = local.minute == 0 ? 'ha' : 'h:mma';
  return DateFormat(pattern).format(local).toLowerCase();
}
