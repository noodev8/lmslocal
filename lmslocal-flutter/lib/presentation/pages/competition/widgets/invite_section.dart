import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
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
                  color: GameTheme.glowCyan.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.group_add,
                  color: GameTheme.glowCyan,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Invite Players',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: GameTheme.textPrimary,
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Invite code
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: GameTheme.backgroundLight,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: GameTheme.border,
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
                    color: GameTheme.glowCyan,
                  ),
                ),
                Container(
                  decoration: BoxDecoration(
                    color: GameTheme.glowCyan.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: IconButton(
                    icon: Icon(Icons.copy, color: GameTheme.glowCyan),
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
                backgroundColor: GameTheme.glowCyan,
                foregroundColor: GameTheme.background,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
