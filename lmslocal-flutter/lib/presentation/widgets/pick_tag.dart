import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';

/// The stamp that says "this one is yours".
///
/// A solid ink tag with the word on it, because the alternatives both failed on
/// the phone. A **tinted fill** — ink at 15% over the stock — is the murky slab
/// design-system.md §8 warns about: on the results screen it made the player's
/// own pending pick look greyed out, as though it had already lost, on a round
/// with no results in at all. A **bare dot** carries no word, so it marks the
/// team without saying what the mark means.
///
/// Solid ink, reversed out in stock, is the coupon's own device and is legible
/// with no colour vision at all.
///
/// A corner stamp on a card, only. It briefly sat inline in the fixture rows too
/// and was removed: pinned to one team's side, it marked a position rather than
/// saying whose stake it was, and those rows now carry a status column that says
/// "Your pick" in words.
class PickTag extends StatelessWidget {
  const PickTag({super.key, this.label = 'PICK'});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: const BoxDecoration(
        color: CouponTheme.ink,
        borderRadius: BorderRadius.zero,
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontFamily: CouponTheme.body,
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 10 * 0.12,
          height: 1.2,
          color: CouponTheme.stockLit,
        ),
      ),
    );
  }
}
