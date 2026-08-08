import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';

/// The player's own two facts: are they still in, and how many lives are left.
///
/// Replaces `dark_status_cards.dart`, which was named for the theme it was
/// drawn in and showed three cells — the third repeated the round number that
/// the block above it already states in bigger type.
///
/// Mirrors the two-column panel on the web's game screen so the same two facts
/// read the same way in both places. Points worth keeping if this is
/// restructured:
///
/// - **The colour is a mark, not a fill.** A dot in `moss` or `overprint`
///   beside the word, never a tinted panel behind it — design-system.md §8, and
///   the trap this app fell into three times during the migration.
/// - **Every status carries its word.** "IN" and "OUT" are legible with no
///   colour vision at all; the dot only confirms what the word already says.
class PlayerStatusBlock extends StatelessWidget {
  const PlayerStatusBlock({
    super.key,
    required this.isStillIn,
    required this.livesRemaining,
  });

  final bool isStillIn;
  final int livesRemaining;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: CouponTheme.stockLit,
        border: Border.fromBorderSide(CouponTheme.rule()),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: _Cell(
                label: 'Your status',
                value: isStillIn ? 'In' : 'Out',
                mark: isStillIn ? CouponTheme.moss : CouponTheme.overprint,
              ),
            ),
            VerticalDivider(
              width: 0.5,
              thickness: 0.5,
              color: CouponTheme.ink.withValues(alpha: 0.3),
            ),
            Expanded(
              child: _Cell(
                label: 'Lives remaining',
                // An eliminated player has no live figure to report, so the
                // cell says so rather than showing a stale count. Nought lives
                // while still in is knockout — the word, because "0" beside
                // "IN" reads as a contradiction.
                value: !isStillIn
                    ? '—'
                    : livesRemaining == 0
                        ? 'Knockout'
                        : '$livesRemaining',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.label, required this.value, this.mark});

  final String label;
  final String value;

  /// The status dot. Absent on cells whose value carries no state.
  final Color? mark;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label.toUpperCase(),
            style: CouponTheme.label,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (mark != null) ...[
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: mark, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 8),
                ],
                // Display tracking, 0.06em per design-system.md §3. Big
                // Shoulders is ultra-condensed, and untracked it sets a
                // two-letter word like "IN" with the strokes touching.
                Text(
                  value.toUpperCase(),
                  style: CouponTheme.heading(26)
                      .copyWith(letterSpacing: 26 * 0.06),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
