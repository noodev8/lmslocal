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
/// - **Locked, picked** — the same facts with the affordance removed. "Locked
///   in" rather than a dead chevron, because a tap that does nothing reads as
///   broken.
/// - **Locked, not picked** — says so plainly. It costs a life and the player
///   should not have to work that out from an absence.
class YourPickBlock extends StatelessWidget {
  const YourPickBlock({
    super.key,
    required this.pick,
    required this.picksOpen,
    this.onTap,
  });

  final CurrentPick? pick;

  /// Whether the round still takes picks. Drives both the copy and whether the
  /// block is tappable at all.
  final bool picksOpen;

  /// Where a tap goes — the Play tab. Null leaves the block inert, which is
  /// what a locked round wants.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final pick = this.pick;
    final tappable = picksOpen && onTap != null;

    return Container(
      decoration: BoxDecoration(
        color: CouponTheme.stockLit,
        border: Border.fromBorderSide(CouponTheme.rule()),
      ),
      child: InkWell(
        onTap: tappable ? onTap : null,
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

  Widget _action({required bool tappable, required bool hasPick}) {
    if (!tappable) {
      return Text(
        hasPick ? 'LOCKED IN' : 'LOCKED',
        style: CouponTheme.label,
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          hasPick ? 'CHANGE' : 'PICK',
          style: CouponTheme.label.copyWith(color: CouponTheme.ink),
        ),
        const Icon(Icons.chevron_right, size: 20, color: CouponTheme.ink),
      ],
    );
  }
}
