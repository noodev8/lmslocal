import 'package:material_ui/material_ui.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/game/games.dart';
import 'package:lmslocal_flutter/core/game/round_state.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';
import 'package:lmslocal_flutter/presentation/widgets/common/competition_logo.dart';
import 'package:lmslocal_flutter/presentation/widgets/game_stamp.dart';

/// A Matchday competition on the dashboard (docs/matchday-app.md §5). The web's
/// card is `lmslocal-web/src/app/dashboard/page.tsx`, `isMatchday`.
///
/// Its own card rather than the LMS one reworded: nobody is "active" or
/// "eliminated" in a league table, and the prompt is predictions, not a pick.
/// Told apart at a glance twice over - printed on BUFF, Matchday's paper, and
/// stamped MATCHDAY above the name.
///
/// MADE OR NOT MADE, NEVER A COUNT. Skipping a match is allowed, so a player
/// who predicted seven of ten has done what the round asks; `needs_pick` for
/// Matchday means "nothing predicted yet". No round number either - the
/// position says where they stand. And on buff, red is a border or an icon,
/// never words: overprint text fails contrast on it.
class MatchdayCard extends StatelessWidget {
  const MatchdayCard({
    super.key,
    required this.competition,
    required this.onRename,
    required this.onHide,
  });

  final Competition competition;
  final VoidCallback onRename;
  final VoidCallback onHide;

  @override
  Widget build(BuildContext context) {
    final standing = competition.matchday;
    final isComplete = competition.status.toUpperCase() == 'COMPLETE';
    final needsPrediction = competition.needsPick ?? false;
    final roundState = deriveDashboardRoundState(
      currentRound: competition.currentRound,
      currentRoundLockTime: competition.currentRoundLockTime,
      competitionComplete: isComplete,
      now: DateTime.now(),
      totalFixtures: competition.totalFixtures,
      fixturesWithResults: competition.fixturesWithResults,
      fixturesProcessed: competition.fixturesProcessed,
    );
    final lock = roundState.lockTime;
    final deadline = lock == null ? null : formatDeadline(lock);

    void open() => context.go(
          needsPrediction ? '/competition/${competition.id}?tab=play' : '/competition/${competition.id}',
          extra: competition,
        );

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: CouponTheme.buff,
        border: Border.fromBorderSide(CouponTheme.rule()),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: open,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CompetitionLogo(name: competition.name, logoUrl: competition.logoUrl, size: 40),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          GameStamp(gameType: competition.gameType),
                          const SizedBox(height: 6),
                          Text(
                            (competition.personalName ?? competition.name).toUpperCase(),
                            style: CouponTheme.heading(26),
                          ),
                          if (competition.personalName != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              competition.name,
                              style: CouponTheme.bodyText.copyWith(fontSize: 13, color: CouponTheme.inkFade),
                            ),
                          ],
                        ],
                      ),
                    ),
                    _iconButton(Icons.edit_outlined, 20, onRename),
                    _iconButton(Icons.delete_outline, 22, onHide),
                  ],
                ),
                const SizedBox(height: 12),

                // Where you stand, then what to do next.
                if (competition.isParticipant &&
                    !isComplete &&
                    standing != null &&
                    standing.position != null) ...[
                  Text.rich(TextSpan(children: [
                    TextSpan(text: ordinal(standing.position!).toUpperCase(), style: CouponTheme.heading(26)),
                    TextSpan(
                      text: ' OF ${standing.players}',
                      style: CouponTheme.heading(26).copyWith(color: CouponTheme.inkFade),
                    ),
                    TextSpan(
                      text: '  ·  ',
                      style: CouponTheme.heading(26).copyWith(color: CouponTheme.ink.withValues(alpha: 0.3)),
                    ),
                    TextSpan(text: '${standing.total ?? 0} PTS', style: CouponTheme.heading(26)),
                    if (standing.provisional)
                      const TextSpan(text: '   SO FAR', style: CouponTheme.label),
                  ])),
                  const SizedBox(height: 10),
                ],

                if (competition.isParticipant && !isComplete) ...[
                  _statusLine(roundState, needsPrediction, deadline),
                  const SizedBox(height: 14),
                ],

                // "Playing", not "active": in a league everyone plays to the end.
                Row(
                  children: [
                    const Icon(Icons.people, size: 16, color: CouponTheme.inkFade),
                    const SizedBox(width: 4),
                    Text(
                      '${standing?.players ?? competition.playerCount} playing',
                      style: CouponTheme.bodyText.copyWith(fontSize: 14, color: CouponTheme.inkFade),
                    ),
                  ],
                ),

                // The result: the top of the table. More than one name is a
                // shared win, recorded with no single winner.
                if (isComplete) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: CouponTheme.mossWash,
                      border: Border.fromBorderSide(CouponTheme.rule()),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          standing != null && standing.firstPlace.length > 1
                              ? 'Shared win: ${standing.firstPlace.join(' and ')}'
                              : 'Winner: ${standing?.firstPlace.firstOrNull ?? competition.winnerName ?? '—'}',
                          style: CouponTheme.bodyText.copyWith(fontSize: 15, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          [
                            standing?.leaderTotal != null ? '${standing!.leaderTotal} points' : 'Game over',
                            if (standing?.position != null) 'you finished ${ordinal(standing!.position!)}',
                          ].join(' · '),
                          style: CouponTheme.bodyText.copyWith(fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: needsPrediction
                      ? ElevatedButton(onPressed: open, child: const Text('MAKE YOUR PREDICTIONS'))
                      : OutlinedButton(
                          onPressed: open,
                          child: Text(isComplete || !competition.isParticipant ? 'VIEW COMPETITION' : 'ENTER'),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _iconButton(IconData icon, double size, VoidCallback onTap) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(icon, size: size, color: CouponTheme.inkFade),
        ),
      );

  Widget _statusLine(RoundState state, bool needsPrediction, String? deadline) {
    switch (state.phase) {
      case RoundPhase.open:
        if (needsPrediction) {
          // The LMS pick box: red border and icon, INK words - red text fails
          // contrast on buff.
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(border: Border.all(color: CouponTheme.overprint)),
            child: Row(
              children: [
                const Icon(Icons.warning_amber_outlined, size: 16, color: CouponTheme.overprint),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    deadline != null ? 'MAKE YOUR PREDICTIONS BY ${deadline.toUpperCase()}' : 'MAKE YOUR PREDICTIONS',
                    style: CouponTheme.label.copyWith(color: CouponTheme.ink),
                  ),
                ),
              ],
            ),
          );
        }
        return Text.rich(TextSpan(children: [
          TextSpan(text: '✓ PREDICTIONS MADE', style: CouponTheme.label.copyWith(color: CouponTheme.moss)),
          if (deadline != null)
            TextSpan(text: ' · LOCKS ${deadline.toUpperCase()}', style: CouponTheme.label),
        ]));
      case RoundPhase.noRound:
        return const Text('WAITING FOR THE FIRST ROUND', style: CouponTheme.label);
      case RoundPhase.complete:
        return const Text('ROUND SETTLED · NEXT ROUND SOON', style: CouponTheme.label);
      default:
        return const Text('MATCHES IN PLAY', style: CouponTheme.label);
    }
  }
}
