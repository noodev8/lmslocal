import 'package:lmslocal_flutter/core/config/app_config.dart';
import 'package:lmslocal_flutter/core/game/round_state.dart';

/// The invitation, ported from `buildJoinUrl` and `buildInviteMessage` in
/// `lmslocal-web/src/lib/templates.ts`.
///
/// The web keeps one definition of this text because the game dashboard once
/// held its own copy and it drifted. The app is now a third place that offers
/// an invitation, so the same rule applies across the two codebases: change the
/// web's `pre_launch_1` template and change this to match.
///
/// The one deliberate difference is the deadline, which is rendered with this
/// app's own `formatLong` — "Saturday 15 March, 3pm" against the web's
/// "Saturday 15 March at 3pm". Same instant, same reading, and it keeps every
/// time in the app phrased one way.

/// The link a player follows to join. The invite code *is* the competition's
/// public identity — there is nothing else to build this from.
String buildJoinUrl(String inviteCode) =>
    '${Config.instance.webBaseUrl}/join/$inviteCode';

/// The message an organiser sends to their players.
///
/// Leads with the link, per docs/player-onboarding.md §2: someone arriving from
/// a message should never have to type anything. The code is in the URL, so
/// repeating it as a second instruction only offers a choice they don't need.
String buildInviteMessage({
  required String competitionName,
  required String joinUrl,
  DateTime? lockTime,
  double? entryFee,
  String? prizeStructure,
}) {
  final lines = <String>[
    '$competitionName — Last Man Standing',
    '',
    "Pick one team each round. If they win you're through; draw or lose and "
        "you're out.",
    '',
    'Join here: $joinUrl',
  ];

  // Free entry says nothing worth a line, so a zero fee is silence rather than
  // "Entry: £0.00" — same rule as the web's formatEntryDetails.
  final entryDetails = <String>[
    if (entryFee != null && entryFee > 0)
      'Entry: £${entryFee.toStringAsFixed(2)}',
    if (prizeStructure != null && prizeStructure.isNotEmpty)
      'Prizes: $prizeStructure',
  ];
  if (entryDetails.isNotEmpty) {
    lines.addAll(['', ...entryDetails]);
  }

  // Without a lock time there is no deadline to state, so the line goes rather
  // than promising the reader something vague.
  if (lockTime != null) {
    lines.addAll(['', 'First round locks ${formatLong(lockTime)}.']);
  }

  return lines.join('\n');
}
