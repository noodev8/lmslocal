import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';

/// Banner shown when a competition is complete
/// Displays the winner or draw result - dark themed
class CompleteBanner extends StatelessWidget {
  final Competition competition;

  const CompleteBanner({
    super.key,
    required this.competition,
  });

  @override
  Widget build(BuildContext context) {
    final winner = competition.winnerName;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: GameTheme.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: GameTheme.border,
          width: 1,
        ),
        boxShadow: GameTheme.borderGlowShadow,
      ),
      child: Column(
        children: [
          // Trophy icon
          Icon(
            Icons.emoji_events_outlined,
            size: 40,
            color: GameTheme.glowCyan,
          ),
          const SizedBox(height: 12),
          Text(
            'Competition Complete',
            style: TextStyle(
              fontSize: 14,
              color: GameTheme.textMuted,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
            decoration: BoxDecoration(
              color: GameTheme.accentGreen.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: GameTheme.accentGreen.withValues(alpha: 0.3),
                width: 1,
              ),
            ),
            child: Column(
              children: [
                Text(
                  winner != null ? 'Winner' : 'Result',
                  style: TextStyle(
                    fontSize: 12,
                    color: GameTheme.textMuted,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  winner ?? 'Draw',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: GameTheme.accentGreen,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
