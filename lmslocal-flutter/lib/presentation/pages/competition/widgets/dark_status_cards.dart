import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';

/// Dark themed status cards for "Still In" and "Lives"
/// Matches the game dashboard dark theme with subtle glow effects
class DarkStatusCards extends StatelessWidget {
  final bool isStillIn;
  final int livesRemaining;

  const DarkStatusCards({
    super.key,
    required this.isStillIn,
    required this.livesRemaining,
  });

  @override
  Widget build(BuildContext context) {
    // Knockout mode: still in but 0 lives
    final bool isKnockout = isStillIn && livesRemaining == 0;
    // Game over: not still in
    final bool isGameOver = !isStillIn;

    return Row(
      children: [
        // Still In card
        Expanded(
          child: _buildCard(
            icon: isStillIn ? Icons.confirmation_num : Icons.cancel,
            iconColor: isStillIn ? GameTheme.accentGreen : GameTheme.accentRed,
            label: 'Still In',
            value: isStillIn ? 'YES' : 'OUT',
            valueColor: isStillIn ? GameTheme.accentGreen : GameTheme.accentRed,
          ),
        ),
        const SizedBox(width: 12),
        // Lives card
        Expanded(
          child: _buildCard(
            icon: Icons.favorite,
            iconColor: isGameOver ? GameTheme.textMuted : GameTheme.accentRed,
            label: isKnockout ? 'Knockout' : 'Lives',
            value: isGameOver ? 'Game Over' : livesRemaining.toString(),
            valueColor: isGameOver ? GameTheme.textMuted : GameTheme.textPrimary,
            isSmallText: isGameOver,
          ),
        ),
      ],
    );
  }

  Widget _buildCard({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
    required Color valueColor,
    bool isSmallText = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: GameTheme.border,
          width: 1,
        ),
        boxShadow: GameTheme.borderGlowShadow,
      ),
      child: Column(
        children: [
          // Label at top
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: GameTheme.textMuted,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 10),
          // Icon and value
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                color: iconColor,
                size: 24,
              ),
              const SizedBox(width: 8),
              Text(
                value,
                style: TextStyle(
                  fontSize: isSmallText ? 14 : 22,
                  fontWeight: FontWeight.bold,
                  color: valueColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
