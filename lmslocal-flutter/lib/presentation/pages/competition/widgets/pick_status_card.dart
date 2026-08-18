import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/domain/entities/pick_statistics.dart';
import 'package:lmslocal_flutter/domain/entities/round_info.dart';

/// How many of the round's picks are in, for whoever can chase the rest.
///
/// Organisers only — see `_showPickProgress` on the competition screen for why.
/// It is a work queue, so it reads as one: the count first in `data` type
/// because it is a figure about real people, the percentage as a quiet label
/// beside it, and a hairline bar under both. Tapping opens the names.
///
/// Drawn to match the web's panel in `lmslocal-web/src/app/game/[id]/page.tsx`
/// rather than the old game theme it shipped in — that version put a tinted
/// green chip, a 10px bar and a bold percentage on a screen where everything
/// around it had moved to the coupon. Colour here is a mark, not a fill
/// (design-system.md §8): the bar's fill is the only ink on it.
class PickStatusCard extends StatelessWidget {
  final RoundInfo round;
  final PickStatistics stats;
  final VoidCallback? onTap;

  const PickStatusCard({
    super.key,
    required this.round,
    required this.stats,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // Clamped because the two figures come from different counts and a round
    // can briefly report more picks than active players - a bar past its own
    // end, or "26 of 24", is the sort of thing an organiser screenshots.
    final picked = stats.playersWithPicks.clamp(0, stats.totalActivePlayers);
    final fraction = stats.totalActivePlayers == 0
        ? 0.0
        : (picked / stats.totalActivePlayers).clamp(0.0, 1.0);

    return InkWell(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: CouponTheme.stockLit,
          border: Border.fromBorderSide(CouponTheme.rule()),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'ROUND ${round.roundNumber} PICKS',
              style: CouponTheme.label,
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Text(
                    '$picked of ${stats.totalActivePlayers} picked',
                    style: CouponTheme.dataText,
                  ),
                ),
                Text('${(fraction * 100).floor()}%', style: CouponTheme.label),
              ],
            ),
            const SizedBox(height: 10),
            // 3 logical pixels, as on the web: a rule that fills, not a gauge.
            // Anything thicker reads as the loudest thing on a screen whose
            // point is the count above it.
            Stack(
              children: [
                Container(height: 3, color: CouponTheme.ink.withValues(alpha: 0.15)),
                FractionallySizedBox(
                  widthFactor: fraction,
                  child: Container(height: 3, color: CouponTheme.overprint),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
