import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/domain/entities/round_info.dart';
import 'package:lmslocal_flutter/domain/entities/unpicked_player.dart';

/// Bottom sheet showing unpicked players for a round
/// Shows different views based on count: all picked, list, or count only
class UnpickedPlayersSheet extends StatelessWidget {
  final RoundInfo round;
  final List<UnpickedPlayer> unpickedPlayers;
  final int? pickPercentage;

  const UnpickedPlayersSheet({
    super.key,
    required this.round,
    required this.unpickedPlayers,
    this.pickPercentage,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Round ${round.roundNumber} - Players',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Content
              if (unpickedPlayers.isEmpty)
                _buildAllPickedContent()
              else if (unpickedPlayers.length <= 10)
                _buildPlayerListContent()
              else
                _buildCountOnlyContent(),

              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAllPickedContent() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: GameTheme.accentGreen.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Text(
              '🎉',
              style: TextStyle(fontSize: 48),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'All players have picked!',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Everyone has made their selection',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlayerListContent() {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 400),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          RichText(
            text: TextSpan(
              style: TextStyle(fontSize: 14, color: Colors.grey[700]),
              children: [
                TextSpan(
                  text: '${unpickedPlayers.length} ${unpickedPlayers.length == 1 ? 'player has' : 'players have'}',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const TextSpan(text: ' not made their pick yet:'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: unpickedPlayers.length,
              separatorBuilder: (context, index) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final player = unpickedPlayers[index];
                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Colors.orange,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          player.displayName,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCountOnlyContent() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Text(
            '${unpickedPlayers.length}',
            style: TextStyle(
              fontSize: 48,
              fontWeight: FontWeight.bold,
              color: AppConstants.primaryNavy,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'players have not made their pick yet',
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey[700],
            ),
            textAlign: TextAlign.center,
          ),
          if (pickPercentage != null) ...[
            const SizedBox(height: 16),
            Text(
              '$pickPercentage% complete',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
