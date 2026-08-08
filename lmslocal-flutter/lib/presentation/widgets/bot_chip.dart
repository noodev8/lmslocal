import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';

/// Marks a bot in any player list. The Flutter twin of the web's
/// `components/BotChip.tsx` — keep the two looking alike.
///
/// Bots used to disclose themselves with a "Bot " name prefix. That prefix now
/// stays on the `app_user` account so the admin pool reads well, and
/// competitions strip it from `competition_user.player_display_name`, which
/// makes **this chip the only bot disclosure a player ever sees**. So it has to
/// appear on every surface that lists names, and each of those surfaces needs
/// its API to return `is_bot` — derived from the bot email pattern in
/// `services/botPool.js`. A screen that forgets it shows bots as ordinary
/// people.
///
/// Deliberately quieter than the "You" chip: an outline rather than a solid
/// fill, because it is a footnote about the row rather than the point of it.
class BotChip extends StatelessWidget {
  const BotChip({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: CouponTheme.ink.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.zero,
      ),
      child: Text('BOT', style: CouponTheme.label.copyWith(fontSize: 10)),
    );
  }
}
