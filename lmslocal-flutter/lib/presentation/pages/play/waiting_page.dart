import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';

/// Waiting page - shown when no rounds or fixtures are ready yet
/// Typically during competition setup phase
class WaitingPage extends StatelessWidget {
  final String competitionId;

  const WaitingPage({
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
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppConstants.primaryNavy.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.schedule,
                size: 64,
                color: AppConstants.primaryNavy,
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'Waiting for Fixtures',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppConstants.primaryNavy,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'The organizer hasn\'t added fixtures for this round yet.',
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[700],
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Check back soon!',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[500],
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
