import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';

/// The way out of a screen inside the competition shell.
///
/// On every tab except the competition dashboard itself, because a bottom bar is
/// not a back button: it offers a set of destinations and asks the player to
/// pick one, when all they wanted was to undo. The eye goes to the top-left for
/// that, finds nothing, and the reflex costs a decision it should not have.
///
/// The screens do not decide where back goes — they call `onPressed`, and
/// `CompetitionNavigationPage` answers, because only the shell knows how the
/// player got in. See §3c of `docs/flutter-migration.md`.
///
/// Sized to sit inside an existing header row rather than above one. 44×44 is
/// the smallest square that is still a comfortable thumb target; the icon is
/// deliberately smaller than the box.
class ShellBackButton extends StatelessWidget {
  const ShellBackButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      icon: const Icon(Icons.arrow_back),
      iconSize: 22,
      color: CouponTheme.ink,
      tooltip: 'Back',
      // Zero padding with explicit constraints: an IconButton's default 48px
      // box plus its own padding would grow every header it is dropped into,
      // which is the line this was meant not to cost.
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints.tightFor(width: 44, height: 44),
      visualDensity: VisualDensity.compact,
    );
  }
}
