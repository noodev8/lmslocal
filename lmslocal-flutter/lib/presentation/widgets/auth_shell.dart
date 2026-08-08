import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';

/// Shared frame for the signed-out screens, mirroring the web's `AuthShell`.
/// Keeps sign in, create account and password reset identical to each other and
/// to their browser counterparts, which is where most players meet the form
/// first.
///
/// Copy note: on the web "you" is always the organiser. **This app is
/// player-only, so here "you" is the player** — do not lift organiser-facing
/// intro copy across. See docs/flutter-migration.md §4.
class AuthShell extends StatelessWidget {
  const AuthShell({
    super.key,
    required this.eyebrow,
    required this.title,
    this.intro,
    required this.children,
    this.showBack = false,
  });

  final String eyebrow;

  /// Uppercased here rather than at the call site — display type is always
  /// uppercase and Flutter has no text-transform, so centralising it is the
  /// only way this rule survives contact with a new screen.
  final String title;
  final String? intro;
  final List<Widget> children;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: showBack
          ? AppBar(
              leading: IconButton(
                icon: const Icon(Icons.arrow_back, color: CouponTheme.ink),
                tooltip: 'Back',
                onPressed: () => Navigator.of(context).pop(),
              ),
            )
          : null,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(child: Image.asset('assets/images/logo.png', height: 96)),
              const SizedBox(height: 36),
              Text(eyebrow, style: CouponTheme.eyebrow),
              const SizedBox(height: 12),
              Text(title.toUpperCase(), style: CouponTheme.heading(44)),
              if (intro != null) ...[
                const SizedBox(height: 16),
                Text(intro!, style: CouponTheme.intro),
              ],
              const SizedBox(height: 32),
              ...children,
            ],
          ),
        ),
      ),
    );
  }
}

/// A field label sitting above its input, matching the web's auth pages.
class AuthField extends StatelessWidget {
  const AuthField({
    super.key,
    required this.label,
    required this.child,
    this.hint,
  });

  final String label;
  final Widget child;

  /// Small print under the field — "2 to 50 characters" and the like.
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: CouponTheme.label),
          const SizedBox(height: 8),
          child,
          if (hint != null) ...[
            const SizedBox(height: 6),
            Text(
              hint!,
              style: CouponTheme.bodyText
                  .copyWith(fontSize: 15, color: CouponTheme.inkFade),
            ),
          ],
        ],
      ),
    );
  }
}

/// Tertiary action: a label with a dotted underline, per design-system.md §6.
class DottedLink extends StatelessWidget {
  const DottedLink({super.key, required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onPressed,
      child: Padding(
        // Keeps the tap target at 48dp without making the rule look loose.
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Text(
          label,
          style: CouponTheme.bodyText.copyWith(
            decoration: TextDecoration.underline,
            decorationStyle: TextDecorationStyle.dotted,
            decorationColor: CouponTheme.ink.withValues(alpha: 0.5),
          ),
        ),
      ),
    );
  }
}

/// A notice, per design-system.md §2: ink text against stock-lit with a rule
/// down the side. Errors never take `overprint` as their text colour — it is
/// the brand's second ink, so an error set in it reads as emphasis, not alarm.
class Notice extends StatelessWidget {
  const Notice({super.key, required this.message, this.isError = true});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: CouponTheme.stockLit,
        border: Border(
          left: BorderSide(
            color: isError ? CouponTheme.overprint : CouponTheme.ink,
            width: 2,
          ),
        ),
      ),
      child: Text(message, style: CouponTheme.bodyText),
    );
  }
}

/// The eye toggle shared by every password field.
Widget passwordToggle({
  required bool obscured,
  required VoidCallback onPressed,
}) {
  return IconButton(
    icon: Icon(
      obscured ? Icons.visibility_outlined : Icons.visibility_off_outlined,
      color: CouponTheme.inkFade,
      size: 20,
    ),
    tooltip: obscured ? 'Show password' : 'Hide password',
    onPressed: onPressed,
  );
}
