import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/domain/entities/competition.dart';

/// Section for organizers to invite players to their competition
/// Shows invite code and share button
class InviteSection extends StatelessWidget {
  final Competition competition;
  final void Function(String text, String label) onCopyToClipboard;

  const InviteSection({
    super.key,
    required this.competition,
    required this.onCopyToClipboard,
  });

  @override
  Widget build(BuildContext context) {
    final inviteCode = competition.inviteCode ?? '';
    final inviteMessage = '''Invite players to
https://lmslocal.co.uk

using competition code:

$inviteCode''';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 2),
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
                  Icons.group_add,
                  color: AppConstants.primaryNavy,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Invite Players',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppConstants.primaryNavy,
                ),
              ),
            ],
          ),

          if (competition.playerCount < 5) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.orange[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: Colors.orange[200]!,
                  width: 1,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    size: 16,
                    color: Colors.orange[700],
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Add more players to start',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.orange[900],
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 16),

          // Invite code
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Colors.grey[300]!,
                width: 1.5,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  inviteCode,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 4,
                    fontFamily: 'monospace',
                    color: AppConstants.primaryNavy,
                  ),
                ),
                Container(
                  decoration: BoxDecoration(
                    color: AppConstants.primaryNavy.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: IconButton(
                    icon: Icon(Icons.copy, color: AppConstants.primaryNavy),
                    onPressed: () => onCopyToClipboard(inviteCode, 'Invite code'),
                    tooltip: 'Copy Code',
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Copy message button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => onCopyToClipboard(inviteMessage, 'Invite message'),
              icon: const Icon(Icons.share, size: 18),
              label: const Text(
                'Share Invite Message',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppConstants.primaryNavy,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
