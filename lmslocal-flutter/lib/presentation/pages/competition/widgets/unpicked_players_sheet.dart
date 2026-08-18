import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/domain/entities/round_info.dart';
import 'package:lmslocal_flutter/domain/entities/unpicked_player.dart';

/// Who still owes a pick, opened from [PickStatusCard].
///
/// Three states, matching the web's modal: everyone is in, a short enough list
/// to name, or too many to be a list. The cut is at ten because past that the
/// names stop being a chase list and become a wall - the count and the
/// percentage say the same thing in one line.
///
/// Names are set in `data` type: a player typed them in, and design-system.md
/// §3 keeps that distinct from anything the app wrote. The dot beside each is
/// `overprint` as a mark rather than a tinted row behind it (§8).
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
      // Square, and on the panel ground. The rounded white sheet it replaced
      // was the last of the old theme on this path, and it arrived over a
      // screen with no rounded corners left on it.
      decoration: BoxDecoration(
        color: CouponTheme.stockLit,
        border: Border(top: CouponTheme.rule()),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'ROUND ${round.roundNumber} PICKS',
                      style: CouponTheme.heading(24),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: CouponTheme.inkFade),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              if (unpickedPlayers.isEmpty)
                _buildAllPickedContent()
              else if (unpickedPlayers.length <= 10)
                _buildPlayerListContent()
              else
                _buildCountOnlyContent(),

              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAllPickedContent() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: Center(
        child: Column(
          children: [
            // No party emoji. The organiser opened this to find out whether
            // there was work left; the answer is the whole content, and
            // celebrating it back at them is the app talking about itself.
            Text(
              'ALL PLAYERS HAVE PICKED',
              style: CouponTheme.heading(24),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Text(
              'Everyone has made their selection for this round.',
              style: CouponTheme.bodyText.copyWith(
                fontSize: 15,
                color: CouponTheme.inkFade,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlayerListContent() {
    final count = unpickedPlayers.length;

    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 400),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text.rich(
            TextSpan(
              style: CouponTheme.bodyText.copyWith(
                fontSize: 15,
                color: CouponTheme.inkFade,
              ),
              children: [
                TextSpan(
                  text: '$count ${count == 1 ? 'player has' : 'players have'}',
                  style: const TextStyle(color: CouponTheme.ink),
                ),
                const TextSpan(text: ' not made their pick yet:'),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Flexible(
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border(
                  top: CouponTheme.rule(),
                  bottom: CouponTheme.rule(),
                ),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                padding: EdgeInsets.zero,
                itemCount: count,
                separatorBuilder: (_, _) => Divider(
                  height: 0.5,
                  thickness: 0.5,
                  color: CouponTheme.ink.withValues(alpha: 0.3),
                ),
                itemBuilder: (context, index) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: CouponTheme.overprint,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            unpickedPlayers[index].displayName,
                            style: CouponTheme.dataText,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCountOnlyContent() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: Column(
          children: [
            Text(
              '${unpickedPlayers.length}',
              style: CouponTheme.heading(64)
                  .copyWith(color: CouponTheme.overprint),
            ),
            const SizedBox(height: 6),
            Text(
              'players have not made their pick yet',
              style: CouponTheme.bodyText.copyWith(
                fontSize: 15,
                color: CouponTheme.inkFade,
              ),
              textAlign: TextAlign.center,
            ),
            if (pickPercentage != null) ...[
              const SizedBox(height: 12),
              Text('$pickPercentage% COMPLETE', style: CouponTheme.label),
            ],
          ],
        ),
      ),
    );
  }
}
