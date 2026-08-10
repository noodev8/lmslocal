import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';

/// The competition's badge — the organiser's pub crest, club logo or company mark.
///
/// It is competition identity rather than a profile picture, and it earns its
/// place in three spots: the join screen (largest, where someone who typed a
/// code off a beer mat needs to see the badge before handing over an email),
/// the dashboard card (small, to tell competitions apart in a list), and the
/// competition header.
///
/// There is always something to draw. A competition with no logo falls back to
/// initials on tinted stock rather than a gap, because an empty square beside a
/// name reads as broken rather than as unset. The same fallback catches a
/// logo_url that 404s, which cannot be known until the network tries — hence
/// the errorBuilder rather than a bare Image.network.
///
/// Square, not circular. The coupon language has no round corners in it, and a
/// crest cropped to a circle loses the text round its edge that most pub badges
/// carry.
class CompetitionLogo extends StatelessWidget {
  final String name;
  final String? logoUrl;
  final double size;

  const CompetitionLogo({
    super.key,
    required this.name,
    this.logoUrl,
    this.size = 48,
  });

  /// Up to two initials, from the first and last word.
  /// "The Crown & Anchor" -> "TA".
  static String initialsFor(String name) {
    final words = name
        .split(RegExp(r'\s+'))
        .map((w) => w.replaceAll(RegExp(r'[^\p{L}\p{N}]', unicode: true), ''))
        .where((w) => w.isNotEmpty)
        .toList();

    if (words.isEmpty) return '?';
    if (words.length == 1) {
      return words.first
          .substring(0, words.first.length >= 2 ? 2 : 1)
          .toUpperCase();
    }
    return (words.first[0] + words.last[0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final url = logoUrl;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: CouponTheme.stock,
        border: Border.fromBorderSide(CouponTheme.rule()),
      ),
      clipBehavior: Clip.antiAlias,
      child: url == null || url.isEmpty
          ? _initials()
          : Image.network(
              url,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => _initials(),
            ),
    );
  }

  Widget _initials() {
    return Center(
      child: Text(
        initialsFor(name),
        // CouponTheme.heading rather than a hand-built TextStyle. BigShoulders
        // is a variable font shipped as a single file, so a style that only
        // names the family renders at its thinnest weight — hairline strokes
        // that no colour can rescue, which is what made the first attempt at
        // this look washed out. heading() carries the weight variation, and it
        // is the app's one display voice besides.
        //
        // The initials stand in for artwork, so they have to hold a list as
        // firmly as a real badge does.
        style: CouponTheme.heading(size * 0.44 < 13 ? 13 : size * 0.44),
      ),
    );
  }
}
