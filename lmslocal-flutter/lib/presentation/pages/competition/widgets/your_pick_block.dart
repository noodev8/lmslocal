import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';

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
///
/// Tappable in every state, because the block sends the player to the Play tab
/// and the Play tab always has something to show them. Only the copy tracks
/// whether the pick can still be changed.
class YourPickBlock extends StatelessWidget {
  const YourPickBlock({
    super.key,
    required this.pick,
    required this.picksOpen,
    this.onTap,
  });

  final CurrentPick? pick;

  /// Whether the round still takes picks. Drives the copy only — a locked round
  /// still leads somewhere worth going.
  final bool picksOpen;

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
                    Text('YOUR PICK', style: CouponTheme.label),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        // A mark beside the value, never a panel behind it —
                        // design-system.md §8.
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: pick != null
                                ? CouponTheme.moss
                                : CouponTheme.overprint,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: _value(pick)),
                      ],
                    ),
                    if (pick != null && pick.fixture.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Padding(
                        // Aligned under the team name, clear of the dot.
                        padding: const EdgeInsets.only(left: 16),
                        child: Text(
                          pick.fixture,
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
      picksOpen ? 'Not picked yet' : 'No pick made',
      style: CouponTheme.intro.copyWith(
        fontSize: 18,
        color: CouponTheme.overprint,
      ),
    );
  }

  /// The word says what the tap does; the chevron says there is one.
  ///
  /// A locked round keeps both: "Locked in" is the reassurance the player came
  /// for, and the tap still opens the round's results. Only the label goes grey,
  /// because the pick itself can no longer be acted on.
  Widget _action({required bool tappable, required bool hasPick}) {
    if (!tappable) {
      return Text(
        hasPick ? 'LOCKED IN' : 'LOCKED',
        style: CouponTheme.label,
      );
    }

    final label = picksOpen
        ? (hasPick ? 'CHANGE' : 'PICK')
        : (hasPick ? 'LOCKED IN' : 'LOCKED');

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: CouponTheme.label.copyWith(
            color: picksOpen ? CouponTheme.ink : CouponTheme.inkFade,
          ),
        ),
        Icon(
          Icons.chevron_right,
          size: 20,
          color: picksOpen ? CouponTheme.ink : CouponTheme.inkFade,
        ),
      ],
    );
  }
}
