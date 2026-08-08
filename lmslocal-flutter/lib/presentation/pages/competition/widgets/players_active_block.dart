import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';

/// How many players are still standing, as the stat block from
/// design-system.md §6: a big number in display type over a label, framed by
/// hairline rules.
///
/// Replaces the cyan glow ring from the old theme. That could not be
/// recoloured — a glow drawn in ink is a murky slab, which is precisely the
/// failure §8 warns about. The count is the whole point of Last Man Standing,
/// so it is stated plainly and large instead.
class PlayersActiveBlock extends StatefulWidget {
  const PlayersActiveBlock({
    super.key,
    required this.playerCount,
    this.label = 'Players still in',
  });

  final int playerCount;
  final String label;

  @override
  State<PlayersActiveBlock> createState() => _PlayersActiveBlockState();
}

class _PlayersActiveBlockState extends State<PlayersActiveBlock>
    with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  Animation<int>? _count;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The resting state is the real number. The count-up is an enhancement, so
    // a screenshot, a slow load or a reduced-motion setting all show the truth
    // rather than a zero that never animates away (design-system.md §7).
    if (_controller != null) return;
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) return;

    final controller = AnimationController(
      duration: const Duration(milliseconds: 700),
      vsync: this,
    );
    _count = IntTween(begin: 0, end: widget.playerCount).animate(
      CurvedAnimation(parent: controller, curve: Curves.easeOutCubic),
    );
    _controller = controller;
    controller.forward();
  }

  @override
  void didUpdateWidget(PlayersActiveBlock oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.playerCount != widget.playerCount) {
      _controller?.stop();
      setState(() {
        _count = null;
      });
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final animation = _count;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 28),
      decoration: BoxDecoration(
        border: Border(
          top: CouponTheme.rule(),
          bottom: CouponTheme.rule(),
        ),
      ),
      child: Column(
        children: [
          animation == null
              ? _Count(widget.playerCount)
              : AnimatedBuilder(
                  animation: animation,
                  builder: (_, _) => _Count(animation.value),
                ),
          const SizedBox(height: 4),
          Text(widget.label.toUpperCase(), style: CouponTheme.label),
        ],
      ),
    );
  }
}

class _Count extends StatelessWidget {
  const _Count(this.value);

  final int value;

  @override
  Widget build(BuildContext context) {
    return Text(
      '$value',
      style: CouponTheme.heading(88).copyWith(color: CouponTheme.overprint),
    );
  }
}
