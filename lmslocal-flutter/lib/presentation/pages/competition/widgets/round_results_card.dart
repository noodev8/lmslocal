import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/domain/entities/round_info.dart';
import 'package:lmslocal_flutter/domain/entities/round_statistics.dart';

/// Card showing results for a locked round
/// Displays won/drew/out breakdown with progress bar
class RoundResultsCard extends StatelessWidget {
  final RoundInfo round;
  final RoundStatistics stats;

  const RoundResultsCard({
    super.key,
    required this.round,
    required this.stats,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppConstants.primaryNavy.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.bar_chart,
                  color: AppConstants.primaryNavy,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Round ${round.roundNumber} Results',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Three-segment bar
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Row(
              children: [
                if (stats.won > 0)
                  Expanded(
                    flex: stats.won,
                    child: Container(
                      height: 10,
                      color: AppConstants.successGreen,
                    ),
                  ),
                if (stats.lost > 0)
                  Expanded(
                    flex: stats.lost,
                    child: Container(
                      height: 10,
                      color: Colors.grey[400],
                    ),
                  ),
                if (stats.eliminated > 0)
                  Expanded(
                    flex: stats.eliminated,
                    child: Container(
                      height: 10,
                      color: AppConstants.errorRed,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Stats breakdown
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStatItem('WON', stats.won, AppConstants.successGreen),
              Container(
                width: 1,
                height: 40,
                color: Colors.grey[300],
              ),
              _buildStatItem('DREW', stats.lost, Colors.grey[600]!),
              Container(
                width: 1,
                height: 40,
                color: Colors.grey[300],
              ),
              _buildStatItem('OUT', stats.eliminated, AppConstants.errorRed),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, int value, Color color) {
    return Column(
      children: [
        Text(
          value.toString(),
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: color.withValues(alpha: 0.8),
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}
