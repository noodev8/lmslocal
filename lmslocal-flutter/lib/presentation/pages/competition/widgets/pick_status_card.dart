import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/domain/entities/pick_statistics.dart';
import 'package:lmslocal_flutter/domain/entities/round_info.dart';

/// Card showing pick progress for current round
/// Displays percentage of players who have made picks
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
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: GameTheme.cardBackground,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: GameTheme.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: GameTheme.accentGreen.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    Icons.check_circle_outline,
                    color: GameTheme.accentGreen,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Picks',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: GameTheme.textPrimary,
                    ),
                  ),
                ),
                Text(
                  '${stats.pickPercentage.floor()}%',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: GameTheme.accentGreen,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: LinearProgressIndicator(
                value: stats.pickPercentage / 100,
                minHeight: 10,
                backgroundColor: GameTheme.backgroundLight,
                valueColor: AlwaysStoppedAnimation<Color>(
                  GameTheme.accentGreen,
                ),
              ),
            ),
            const SizedBox(height: 12),

            Text(
              '${stats.playersWithPicks} of ${stats.totalActivePlayers} players have picked',
              style: TextStyle(
                fontSize: 13,
                color: GameTheme.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
