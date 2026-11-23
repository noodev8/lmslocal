import 'package:intl/intl.dart';

/// The games LMS Local runs, and the words each one uses.
///
/// The Dart half of `lmslocal-web/src/lib/games.ts`; keep the two in step.
/// docs/matchday.md §2 and docs/matchday-app.md §9, §13.
///
/// Every screen that names a game, states Matchday's scoring or describes how
/// a game ends takes it from here. "Matchday" is a working name: renaming it is
/// a change to [gameNames], not a hunt through pages.
///
/// THE VOCABULARIES DO NOT MIX. LMS says pick, lives, eliminated, still in.
/// Matchday says predict, prediction, points, the table. And no betting words
/// in either: never "back", "backed" or "backing" a team.

/// `competition.game_type`. Missing or null is LMS, the same as the server.
class GameType {
  static const String lms = 'lms';
  static const String matchday = 'matchday';
}

const Map<String, String> gameNames = {
  GameType.lms: 'Last Man Standing',
  GameType.matchday: 'Matchday',
};

/// The name for a competition's game. Anything unset or unknown is LMS.
String gameName(String? gameType) =>
    gameNames[gameType ?? GameType.lms] ?? gameNames[GameType.lms]!;

/// Matchday's scoring, stated the same way everywhere it appears. 3 / 1 / 0
/// since 2026-11-23 (it was 3 / 1 / −1), the same as the web's games.ts.
const String matchdayScoring = 'Win +3 · Draw +1 · Lose 0';

/// "6 rounds". "First to 20 points" survives only on two old test
/// competitions made before points targets were withdrawn.
String endingLabel(String? rule, int? value) {
  if (rule == null || value == null || value == 0) return '';
  if (rule == 'points') return 'First to $value points';
  return '$value round${value == 1 ? '' : 's'}';
}

/// 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st.
String ordinal(int n) {
  final tens = n % 100;
  if (tens >= 11 && tens <= 13) return '${n}th';
  switch (n % 10) {
    case 1:
      return '${n}st';
    case 2:
      return '${n}nd';
    case 3:
      return '${n}rd';
    default:
      return '${n}th';
  }
}

/// "+3", "+1", "0". No score is negative since 3 / 1 / 0; the typographic minus
/// (U+2212) stays in case one ever is, so it would still read as a sign.
String signedPoints(int points) {
  if (points > 0) return '+$points';
  if (points < 0) return '−${points.abs()}';
  return '0';
}

/// The word for a settled prediction: Won, Drew, Lost, or Void.
///
/// Read from the match result, never from the points: the points say what a
/// result was worth, and would make every word wrong the day the scoring
/// changes. No result on a settled prediction is a postponement fixed by hand.
String outcomeWord(String? myTeam, String? result) {
  if (myTeam == null) return '';
  if (result == null) return 'Void';
  if (result == 'DRAW') return 'Drew';
  return result == myTeam ? 'Won' : 'Lost';
}

/* -----------------------------------------------------------------------------
 * UK time
 *
 * Kickoffs and locks are UK kickoffs, and a player abroad still needs the time
 * the match actually starts, so Matchday shows them in Europe/London whatever
 * the phone's zone (docs/matchday-app.md §9). Dart has no zone database without
 * the `timezone` package and its data file, and the UK's rule is short enough
 * to state exactly: British Summer Time runs from 01:00 UTC on the last Sunday
 * of March to 01:00 UTC on the last Sunday of October.
 * -------------------------------------------------------------------------- */

DateTime _lastSundayUtc(int year, int month) {
  // The last day of the month, stepped back to a Sunday (weekday 7).
  final last = DateTime.utc(year, month + 1, 0, 1);
  return last.subtract(Duration(days: last.weekday % 7));
}

/// [time] as a wall-clock time in the UK. The result's fields are UK local
/// time; it is a UTC-flagged value only so nothing converts it a second time.
DateTime ukTime(DateTime time) {
  final utc = time.toUtc();
  final bstStart = _lastSundayUtc(utc.year, 3);
  final bstEnd = _lastSundayUtc(utc.year, 10);
  final summer = !utc.isBefore(bstStart) && utc.isBefore(bstEnd);
  return summer ? utc.add(const Duration(hours: 1)) : utc;
}

String _ukClock(DateTime uk) {
  final pattern = uk.minute == 0 ? 'ha' : 'h:mma';
  return DateFormat(pattern).format(uk).toLowerCase();
}

/// "Sat 28 Nov, 3pm" - UK time, ":00" dropped on the hour. `formatKickoff` in
/// games.ts.
String formatKickoff(DateTime time) {
  final uk = ukTime(time);
  return '${DateFormat('EEE d MMM').format(uk)}, ${_ukClock(uk)}';
}

/// "Fri 8pm" within the coming week, "Fri 4 Dec, 8pm" further out. For the
/// dashboard card's deadline, where the short form is easier to take in.
String formatDeadline(DateTime time, {DateTime? now}) {
  final uk = ukTime(time);
  final withinWeek = time.difference(now ?? DateTime.now()) < const Duration(days: 6);
  final date = DateFormat(withinWeek ? 'EEE' : 'EEE d MMM').format(uk);
  return withinWeek ? '$date ${_ukClock(uk)}' : '$date, ${_ukClock(uk)}';
}
