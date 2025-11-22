import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';

/// Large glowing circular widget displaying active player count
/// Centerpiece of the game dashboard with cyan glow effect
/// Animates on entrance with scale, glow pulse, and count-up
class GlowingPlayersCircle extends StatefulWidget {
  final int playerCount;
  final String? label;

  const GlowingPlayersCircle({
    super.key,
    required this.playerCount,
    this.label = 'Players\nActive',
  });

  @override
  State<GlowingPlayersCircle> createState() => _GlowingPlayersCircleState();
}

class _GlowingPlayersCircleState extends State<GlowingPlayersCircle>
    with TickerProviderStateMixin {
  late AnimationController _scaleController;
  late AnimationController _glowController;
  late AnimationController _countController;

  late Animation<double> _scaleAnimation;
  late Animation<double> _glowAnimation;
  late Animation<int> _countAnimation;

  @override
  void initState() {
    super.initState();

    // Scale animation - bouncy entrance
    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _scaleAnimation = CurvedAnimation(
      parent: _scaleController,
      curve: Curves.elasticOut,
    );

    // Glow pulse animation - pulses then settles
    _glowController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );
    _glowAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.3, end: 0.8)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 30,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.8, end: 0.4)
            .chain(CurveTween(curve: Curves.easeInOut)),
        weight: 35,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.4, end: 0.5)
            .chain(CurveTween(curve: Curves.easeInOut)),
        weight: 35,
      ),
    ]).animate(_glowController);

    // Count-up animation
    _countController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    _countAnimation = IntTween(
      begin: 0,
      end: widget.playerCount,
    ).animate(CurvedAnimation(
      parent: _countController,
      curve: Curves.easeOutCubic,
    ));

    // Start animations with slight delays
    _startAnimations();
  }

  void _startAnimations() async {
    await Future.delayed(const Duration(milliseconds: 100));
    if (mounted) {
      _scaleController.forward();
      _glowController.forward();
    }
    await Future.delayed(const Duration(milliseconds: 300));
    if (mounted) {
      _countController.forward();
    }
  }

  @override
  void didUpdateWidget(GlowingPlayersCircle oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Update count animation if player count changes
    if (oldWidget.playerCount != widget.playerCount) {
      _countAnimation = IntTween(
        begin: _countAnimation.value,
        end: widget.playerCount,
      ).animate(CurvedAnimation(
        parent: _countController,
        curve: Curves.easeOutCubic,
      ));
      _countController.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _scaleController.dispose();
    _glowController.dispose();
    _countController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Center(
        child: AnimatedBuilder(
          animation: Listenable.merge([
            _scaleAnimation,
            _glowAnimation,
            _countAnimation,
          ]),
          builder: (context, child) {
            return Transform.scale(
              scale: _scaleAnimation.value,
              child: _buildGlowingRing(),
            );
          },
        ),
      ),
    );
  }

  Widget _buildGlowingRing() {
    const double ringSize = 220;
    const double ringThickness = 4;

    // Animated glow intensity
    final glowIntensity = _glowAnimation.value;

    return SizedBox(
      width: ringSize + 60,
      height: ringSize + 60,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Outer glow layer (animated)
          Container(
            width: ringSize + 30,
            height: ringSize + 30,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: GameTheme.glowCyan.withValues(alpha: glowIntensity),
                  blurRadius: 40 + (glowIntensity * 20),
                  spreadRadius: 10 + (glowIntensity * 10),
                ),
                BoxShadow(
                  color: GameTheme.glowCyan.withValues(alpha: glowIntensity * 0.5),
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
        // Animated player count number
        AnimatedBuilder(
          animation: _countAnimation,
          builder: (context, child) {
            return Text(
              _countAnimation.value.toString(),
              style: TextStyle(
                fontSize: 72,
                fontWeight: FontWeight.w900,
                color: GameTheme.textPrimary,
                height: 1.0,
                letterSpacing: -2,
              ),
            );
          },
        ),
        const SizedBox(height: 8),
        // Label text
        Text(
          widget.label ?? 'Players\nActive',
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
