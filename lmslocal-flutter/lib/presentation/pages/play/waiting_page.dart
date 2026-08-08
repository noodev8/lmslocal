import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/presentation/widgets/shell_back_button.dart';

/// Waiting page - shown when no rounds or fixtures are ready yet
/// Typically during competition setup phase
class WaitingPage extends StatelessWidget {
  final String competitionId;

  /// Leaves the Play tab — see `ShellBackButton`.
  final VoidCallback? onBack;

  const WaitingPage({
    super.key,
    required this.competitionId,
    this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    // The only one of the three Play screens with no header to put the arrow
    // in — and the one where a player is most likely to want out, since there
    // is nothing here to do. It gets its own row; the screen has the space.
    return Column(
      children: [
        if (onBack != null)
          Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: const EdgeInsets.only(left: 8, top: 8),
              child: ShellBackButton(onPressed: onBack!),
            ),
          ),
        Expanded(child: _buildBody()),
      ],
    );
  }

  Widget _buildBody() {
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
