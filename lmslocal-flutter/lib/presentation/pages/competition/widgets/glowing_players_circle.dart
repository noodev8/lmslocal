import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';

/// Large glowing circular widget displaying active player count
/// Centerpiece of the game dashboard with cyan glow effect
class GlowingPlayersCircle extends StatelessWidget {
  final int playerCount;
  final String? label;

  const GlowingPlayersCircle({
    super.key,
    required this.playerCount,
    this.label = 'Players\nActive',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Center(
        child: _buildGlowingRing(),
      ),
    );
  }

  Widget _buildGlowingRing() {
    const double ringSize = 220;
    const double ringThickness = 4;

    return SizedBox(
      width: ringSize + 60, // Extra space for glow
      height: ringSize + 60,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Outer glow layer (blurred)
          Container(
            width: ringSize + 30,
            height: ringSize + 30,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: GameTheme.glowCyan.withValues(alpha: 0.3),
                  blurRadius: 40,
                  spreadRadius: 10,
                ),
                BoxShadow(
                  color: GameTheme.glowCyan.withValues(alpha: 0.15),
                  blurRadius: 80,
                  spreadRadius: 20,
                ),
              ],
            ),
          ),

          // Main ring with gradient border
          Container(
            width: ringSize,
            height: ringSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  GameTheme.glowCyan,
                  GameTheme.glowTeal,
                  GameTheme.glowBlue.withValues(alpha: 0.5),
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: GameTheme.glowCyan.withValues(alpha: 0.5),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.all(ringThickness),
              child: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: GameTheme.background,
                ),
                child: _buildContent(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Large player count number
        Text(
          playerCount.toString(),
          style: TextStyle(
            fontSize: 72,
            fontWeight: FontWeight.w900,
            color: GameTheme.textPrimary,
            height: 1.0,
            letterSpacing: -2,
          ),
        ),
        const SizedBox(height: 8),
        // Label text
        Text(
          label ?? 'Players\nActive',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: GameTheme.textSecondary,
            height: 1.3,
          ),
        ),
      ],
    );
  }
}
