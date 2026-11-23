import 'package:material_ui/material_ui.dart';
import 'package:lmslocal_flutter/core/game/games.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';

/// The game's name as a stamp: `MATCHDAY` / `LAST MAN STANDING` in the label
/// style inside a 1px ink border, ink text. On every dashboard card of both
/// games, above the competition's name, so it is read first and a player never
/// has to infer the game from the card's colour (docs/matchday-app.md §5).
///
/// Ink, not a colour per game: the palette has no spare ink, and a fourth is a
/// design-system decision that has not been taken.
class GameStamp extends StatelessWidget {
  const GameStamp({super.key, required this.gameType});

  final String? gameType;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(border: Border.all(color: CouponTheme.ink)),
      child: Text(
        gameName(gameType).toUpperCase(),
        style: CouponTheme.label.copyWith(
          fontSize: 11,
          letterSpacing: 11 * 0.12,
          color: CouponTheme.ink,
        ),
      ),
    );
  }
}
