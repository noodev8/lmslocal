import 'package:material_ui/material_ui.dart';
import 'package:lmslocal_flutter/core/game/games.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';

/// The pieces every Matchday screen shares, so the four of them read as one
/// game. Built to docs/design-system.md through [CouponTheme]: stock grounds,
/// ink, hairline rules, the one print-offset shadow on a held card.
///
/// Matchday's own screens stay on the usual stock. Buff is the dashboard
/// card's paper only, until the owner decides otherwise (docs/matchday-app.md
/// §14).

/// A lifted panel: stock-lit with a hairline border.
BoxDecoration matchdayPanel({Color color = CouponTheme.stockLit}) => BoxDecoration(
      color: color,
      border: Border.fromBorderSide(CouponTheme.rule()),
    );

/// The top bar of a Matchday screen: a way back on the left, the game's name on
/// the right - the game is the first thing on every screen (docs/matchday.md
/// §8.1).
class MatchdayHeader extends StatelessWidget {
  const MatchdayHeader({super.key, required this.backLabel, required this.onBack});

  final String backLabel;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(border: Border(bottom: CouponTheme.rule())),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(4, 4, 16, 4),
          child: Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: onBack,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                    child: Row(
                      children: [
                        const Icon(Icons.arrow_back, size: 20, color: CouponTheme.inkFade),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            backLabel.toUpperCase(),
                            style: CouponTheme.label,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(gameNames[GameType.matchday]!.toUpperCase(), style: CouponTheme.label),
            ],
          ),
        ),
      ),
    );
  }
}

/// A failure said in ink beside an overprint rule - never red text, which
/// reads as emphasis rather than as an error (design-system §2).
class MatchdayErrorLine extends StatelessWidget {
  const MatchdayErrorLine({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: CouponTheme.stockLit,
        border: Border(left: BorderSide(color: CouponTheme.overprint, width: 2)),
      ),
      child: Text(message, style: CouponTheme.bodyText.copyWith(fontSize: 15)),
    );
  }
}

class MatchdayLoading extends StatelessWidget {
  const MatchdayLoading({super.key, this.line});

  final String? line;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: matchdayPanel(),
      child: Column(
        children: [
          const SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(height: 16),
          const Text('LOADING', style: CouponTheme.eyebrow),
          if (line != null) ...[
            const SizedBox(height: 8),
            Text(
              line!,
              textAlign: TextAlign.center,
              style: CouponTheme.bodyText.copyWith(color: CouponTheme.inkFade),
            ),
          ],
        ],
      ),
    );
  }
}

/// A load that failed, with the way to try again.
class MatchdayLoadFailed extends StatelessWidget {
  const MatchdayLoadFailed({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: matchdayPanel(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(message, style: CouponTheme.bodyText),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('TRY AGAIN')),
        ],
      ),
    );
  }
}

/// A text link in the label style with a dotted-looking underline, the web's
/// "Full table" / "← Round 2".
class MatchdayTextLink extends StatelessWidget {
  const MatchdayTextLink({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Text(
          label.toUpperCase(),
          style: CouponTheme.label.copyWith(
            color: CouponTheme.ink,
            decoration: TextDecoration.underline,
            decorationStyle: TextDecorationStyle.dotted,
            decorationColor: CouponTheme.ink,
          ),
        ),
      ),
    );
  }
}

/// A display-type heading - always uppercase.
Text matchdayHeading(String text, {double size = 32}) =>
    Text(text.toUpperCase(), style: CouponTheme.heading(size));
