import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';

/// Standings page - placeholder for Phase 2
/// Will show competition leaderboards and results
class StandingsPage extends StatelessWidget {
  final String competitionId;

  const StandingsPage({
    super.key,
    required this.competitionId,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppConstants.paddingLarge),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.leaderboard,
              size: 100,
              color: AppConstants.primaryNavy.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 24),
            Text(
              'Standings',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppConstants.primaryNavy,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Competition ID: $competitionId',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Competition leaderboards and results will appear here',
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Coming in Phase 2',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[400],
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
