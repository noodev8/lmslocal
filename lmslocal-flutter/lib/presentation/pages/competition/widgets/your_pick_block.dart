import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';

/// What became of the pick, once the round has been processed.
///
/// `unknown` is not `pending`: pending means the round is settled for others but
/// this player's outcome has not been written, while unknown means nothing has
/// been asked. They render the same today and are kept apart so a future caller
/// cannot mistake "not fetched" for "no result".
enum PickOutcome { unknown, pending, won, lost }

/// The player's own pick for the current round, and the way back to change it.
///
/// The competition dashboard could say where the round had got to — "Picks close
/// Saturday 9 August, 3pm" — but nothing about whether *this* player had done
/// their bit. A player who had just picked came back to a screen that looked
/// identical to one who hadn't, so the only way to confirm a pick was to open
/// the Play tab and read the highlight off the fixture list. That is the same
/// failure §3b fixed on the pick screen itself, one screen along: no
/// confirmation where the player looks for it.
///
/// Four states, and the difference between them is the point:
///
/// - **Open, picked** — the team, its fixture, and a tap that reopens Play to
///   change it. Changing a pick is one tap there (§3b), so this promises
///   something cheap.
/// - **Open, not picked** — stated in `overprint`, the same ink the dashboard
///   card uses for a pick owed, and tappable straight into Play.
/// - **Locked, picked** — "Locked in", still tappable. The destination is the
///   same Play tab, which now routes to the round's results, so the tap remains
///   worth making even though the pick cannot change. The chevron stays for that
///   reason; only the word changes.
/// - **Locked, not picked** — says so plainly. It costs a life and the player
///   should not have to work that out from an absence.
/// - **Settled** — "Won" or "Lost" in place of "Locked in", with the mark to
///   match. The block used to disappear when the round completed, which took the
///   answer away at the moment the player came looking for it: the screen said
///   "After round 1" and nothing said what round 1 had done to them.
///
/// - **Knocked out** — the pick that ended it, named with its round, and the tap
///   goes to the standings rather than to Play. An eliminated player has no stake
///   in the current round, so Play has nothing of theirs to show; the standings
///   have their row, their round, and everyone who is still going.
///
/// Tappable in every state, because the block always leads somewhere with more of
/// the same story. Only the copy tracks what the tap will find.
class YourPickBlock extends StatelessWidget {
  const YourPickBlock({
    super.key,
    required this.pick,
    required this.picksOpen,
    this.outcome = PickOutcome.unknown,
    this.knockedOutInRound,
    this.onTap,
  });

  final CurrentPick? pick;

  /// How the pick finished, once the round has been processed.

  /// Whether the round still takes picks. Drives the copy only — a locked round
  /// still leads somewhere worth going.
  final bool picksOpen;

  final PickOutcome outcome;

  /// Set when this is the pick that eliminated the player, and which round it
  /// was. The round has to be named: by the time they read it there is usually a
  /// newer round on the screen above, so an unlabelled team would look like a
  /// pick in the round now being played.
  final int? knockedOutInRound;

  /// Where a tap goes — the Play tab, which routes to the pick screen or the
  /// round's results depending on the lock. Null leaves the block inert.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final pick = this.pick;
    final tappable = onTap != null;

    return Container(
      decoration: BoxDecoration(
        color: CouponTheme.stockLit,
        border: Border.fromBorderSide(CouponTheme.rule()),
      ),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      knockedOutInRound != null
                          ? 'YOUR LAST PICK · ROUND $knockedOutInRound'
                          : 'YOUR PICK',
                      style: CouponTheme.label,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        // A mark beside the value, never a panel behind it —
                        // design-system.md §8. Moss for a pick in hand or a pick
                        // that won, overprint for one that lost or was never
                        // made: the two things a player is sorry to see.
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: (pick != null &&
                                    outcome != PickOutcome.lost &&
                                    knockedOutInRound == null)
                                ? CouponTheme.moss
                                : CouponTheme.overprint,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: _value(pick)),
                      ],
                    ),
                    if (_caption(pick) case final caption?) ...[
                      const SizedBox(height: 4),
                      Padding(
                        // Aligned under the team name, clear of the dot.
                        padding: const EdgeInsets.only(left: 16),
                        child: Text(
                          caption,
                          style: CouponTheme.dataText.copyWith(
                            fontSize: 13,
                            color: CouponTheme.inkFade,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 12),
              _action(tappable: tappable, hasPick: pick != null),
            ],
          ),
        ),
      ),
    );
  }

  /// The fixture, on its own.
  ///
  /// The round used to be prefixed here for a knocked-out player, and a real
  /// fixture pushed it onto two lines — "Round 2 · Crystal Palace vs Fulham". It
  /// belongs with the heading anyway: the heading is where this block says which
  /// round it is talking about, and a live round says nothing there because the
  /// round is what the whole screen is about.
  String? _caption(CurrentPick? pick) {
    final fixture = pick?.fixture ?? '';
    return fixture.isEmpty ? null : fixture;
  }

  /// The team as the player picked it, in `font-data` — a value someone chose,
  /// not interface chrome (design-system.md §3). The empty states are the app
  /// talking, so they are set in body type instead.
  Widget _value(CurrentPick? pick) {
    if (pick != null) {
      return Text(
        pick.teamFullName,
        style: CouponTheme.dataText.copyWith(fontSize: 19),
        overflow: TextOverflow.ellipsis,
      );
    }

    return Text(
      // A knocked-out player with no pick went out by missing one, which is a
      // different sentence from a round still open.
      picksOpen ? 'Not picked yet' : 'No pick made',
      style: CouponTheme.intro.copyWith(
        fontSize: 18,
        color: CouponTheme.overprint,
      ),
    );
  }

  /// The word says where the round has got to for this player; the chevron says
  /// there is somewhere to tap.
  ///
  /// "Won" and "Lost" beat "Locked in" once the round is processed — the pick is
  /// still the subject, but its outcome is the news. Both keep the chevron,
  /// because the tap now opens the full results, which is the natural next
  /// question after either one.
  Widget _action({required bool tappable, required bool hasPick}) {
    final String label;
    final Color colour;

    // Knocked out beats the round's own state: whatever phase the competition has
    // moved on to, this block is about the round that ended their run.
    if (knockedOutInRound != null) {
      label = 'LOST';
      colour = CouponTheme.overprint;
      return _labelled(label, colour, tappable);
    }

    switch (outcome) {
      case PickOutcome.won:
        label = 'WON';
        colour = CouponTheme.moss;
      case PickOutcome.lost:
        label = 'LOST';
        colour = CouponTheme.overprint;
      case PickOutcome.pending:
      case PickOutcome.unknown:
        if (picksOpen) {
          label = hasPick ? 'CHANGE' : 'PICK';
          colour = CouponTheme.ink;
        } else {
          label = hasPick ? 'LOCKED IN' : 'LOCKED';
          colour = CouponTheme.inkFade;
        }
    }

    return _labelled(label, colour, tappable);
  }

  Widget _labelled(String label, Color colour, bool tappable) {
    final style = CouponTheme.label.copyWith(
      color: colour,
      fontWeight: outcome == PickOutcome.won ? FontWeight.w600 : null,
    );

    if (!tappable) return Text(label, style: style);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: style),
        Icon(Icons.chevron_right, size: 20, color: colour),
      ],
    );
  }
}
