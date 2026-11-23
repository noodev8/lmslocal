import 'package:material_ui/material_ui.dart';
import 'package:lmslocal_flutter/core/di/injection.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:url_launcher/url_launcher.dart';

/// The forced update: when the installed build is below the server's minimum
/// (`/check-app-version`, the `app_version` table), nothing in the app is
/// reachable - only a button to the store.
///
/// WRAPS THE WHOLE APP, not the splash screen. Until 2.1.0 the check lived on
/// the splash screen, and an invite link or a notification skips the splash: a
/// player on a retired build tapped a link and went straight to a join screen
/// that could not work for them. Here it sits in `MaterialApp.router`'s
/// builder, above every route, and checks on ENTRY ONLY (decided 2026-11-23,
/// not on every return to the app):
///   - every launch, however the app was opened (icon, link, notification);
///   - every invite link, through [VersionGate.check] from the join screen. A
///     link tapped while the app is in the background resumes it without a
///     launch, and joining is exactly when an old build meets a game it cannot
///     show.
///
/// The update screen REPLACES the app rather than being a dialog over it. The
/// builder sits above the navigator, so there is no route to push a dialog on -
/// which is why the first attempt at a resume check (Nov 2025, reverted) never
/// showed anything.
///
/// The check fails open (`VersionRemoteDataSource`): a server blip must never
/// lock everyone out. Once blocked, the app stays blocked - only installing the
/// update fixes it, and that restarts the app anyway.
class VersionGate extends StatefulWidget {
  const VersionGate({super.key, required this.child});

  final Widget child;

  /// Check again now - for an entry that is not a launch (an invite link
  /// opening a running app). A check already in flight covers it.
  static void check(BuildContext context) =>
      context.findAncestorStateOfType<_VersionGateState>()?._check();

  @override
  State<VersionGate> createState() => _VersionGateState();
}

class _VersionGateState extends State<VersionGate> {
  String? _storeUrl;
  bool _checking = false;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    if (_checking || _storeUrl != null) return;
    _checking = true;
    try {
      final result = await Injection.getVersionRemoteDataSource().checkAppVersion();
      if (result != null && mounted) setState(() => _storeUrl = result.storeUrl);
    } finally {
      _checking = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final storeUrl = _storeUrl;
    if (storeUrl == null) return widget.child;
    return _UpdateRequiredScreen(storeUrl: storeUrl);
  }
}

class _UpdateRequiredScreen extends StatelessWidget {
  const _UpdateRequiredScreen({required this.storeUrl});

  final String storeUrl;

  Future<void> _openStore() async {
    final uri = Uri.parse(storeUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    // No back and no dismiss: past this screen is a build the server no longer
    // serves, so the player would meet an error instead of an instruction.
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: CouponTheme.stock,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Image.asset('assets/images/logo.png', width: 96, height: 96),
                const SizedBox(height: 32),
                Text('UPDATE REQUIRED', style: CouponTheme.heading(32)),
                const SizedBox(height: 12),
                const Text(
                  'This version of LMS Local is out of date and can no longer be '
                  'used. Install the latest version to carry on - then tap your '
                  'link again, or open the app.',
                  style: CouponTheme.bodyText,
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _openStore,
                    child: const Text('UPDATE'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
