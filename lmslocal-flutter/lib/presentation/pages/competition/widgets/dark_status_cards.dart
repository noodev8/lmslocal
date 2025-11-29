import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';

/// Dark themed status cards for "Round", "Still In" and "Lives"
/// Compact, responsive design - mobile first
class DarkStatusCards extends StatelessWidget {
  final int roundNumber;
  final bool isStillIn;
  final int livesRemaining;

  const DarkStatusCards({
    super.key,
    required this.roundNumber,
    required this.isStillIn,
    required this.livesRemaining,
  });

  @override
  Widget build(BuildContext context) {
    // Knockout mode: still in but 0 lives
    final bool isKnockout = isStillIn && livesRemaining == 0;
    // Game over: not still in
    final bool isGameOver = !isStillIn;

    return LayoutBuilder(
      builder: (context, constraints) {
        // Responsive gap based on available width
        final gap = constraints.maxWidth < 320 ? 4.0 : 6.0;

        return Row(
          children: [
            // Round card
            Expanded(
              child: _buildCard(
                icon: Icons.flag_outlined,
                iconColor: GameTheme.glowCyan,
                label: 'Round',
                value: roundNumber.toString(),
                valueColor: GameTheme.textPrimary,
              ),
            ),
            SizedBox(width: gap),
            // Status card
            Expanded(
              child: _buildCard(
                icon: isStillIn ? Icons.check_circle : Icons.cancel,
                iconColor: isStillIn ? GameTheme.accentGreen : GameTheme.accentRed,
                label: 'Status',
                value: isStillIn ? 'IN' : 'OUT',
                valueColor: isStillIn ? GameTheme.accentGreen : GameTheme.accentRed,
              ),
            ),
            SizedBox(width: gap),
            // Lives card
            Expanded(
              child: _buildCard(
                icon: Icons.favorite,
                iconColor: isGameOver ? GameTheme.textMuted : GameTheme.accentRed,
                label: isKnockout ? 'Mode' : 'Lives',
                value: isKnockout ? 'KO' : (isGameOver ? '-' : livesRemaining.toString()),
                valueColor: isGameOver ? GameTheme.textMuted : GameTheme.textPrimary,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildCard({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
    required Color valueColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: GameTheme.border,
          width: 1,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Icon
          Icon(
            icon,
            color: iconColor,
            size: 18,
          ),
          const SizedBox(height: 4),
          // Value
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: valueColor,
              ),
            ),
          ),
          const SizedBox(height: 2),
          // Label
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: GameTheme.textMuted,
            ),
          ),
        ],
      ),
    );
  }
}
