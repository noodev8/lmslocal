import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/domain/entities/round_info.dart';

class ActivePlayersRing extends StatelessWidget {
  final RoundInfo round;
  final int activeCount;
  final int totalPlayers;

  const ActivePlayersRing({
    super.key,
    required this.round,
    required this.activeCount,
    required this.totalPlayers,
  });

  @override
  Widget build(BuildContext context) {
    // Calculate progress (ensure it's between 0 and 1)
    final double progress = totalPlayers > 0 
        ? (activeCount / totalPlayers).clamp(0.0, 1.0) 
        : 0.0;

    return Column(
      children: [
        Text(
          'ROUND ${round.roundNumber}',
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: Color(0xFF94A3B8), // Slate 400
            letterSpacing: 2.0,
          ),
        ),
        const SizedBox(height: 24),
        
        // The Ring
        SizedBox(
          width: 220,
          height: 220,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Glow Effect
              Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.4),
                      blurRadius: 40,
                      spreadRadius: -5,
                    ),
                  ],
                ),
              ),
              // Background Ring
              SizedBox(
                width: 200,
                height: 200,
                child: CircularProgressIndicator(
                  value: 1.0,
                  strokeWidth: 12,
                  color: const Color(0xFF1E293B), // Slate 800
                ),
              ),
              // Gradient Progress Ring
              SizedBox(
                width: 200,
                height: 200,
                child: ShaderMask(
                  shaderCallback: (rect) {
                    return const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Color(0xFF10B981), // Neon Green
                        Color(0xFF3B82F6), // Electric Blue
                      ],
                    ).createShader(rect);
                  },
                  child: CircularProgressIndicator(
                    value: progress,
                    strokeWidth: 12,
                    color: Colors.white, // Required for ShaderMask
                    strokeCap: StrokeCap.round,
                  ),
                ),
              ),
              // Inner Content
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    activeCount.toString(),
                    style: const TextStyle(
                      fontSize: 72,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      height: 1.0,
                      letterSpacing: -2,
                      shadows: [
                        BoxShadow(
                          color: Color(0xFF3B82F6),
                          blurRadius: 20,
                          spreadRadius: 0,
                        )
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(0xFF3B82F6).withValues(alpha: 0.3),
                        width: 1,
                      ),
                    ),
                    child: const Text(
                      'PLAYERS ACTIVE',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF93C5FD), // Light Blue
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
