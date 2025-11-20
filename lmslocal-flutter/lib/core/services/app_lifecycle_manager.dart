import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/di/injection.dart';
import 'package:lmslocal_flutter/presentation/widgets/update_required_dialog.dart';

/// Manages app lifecycle events and checks version when app resumes
class AppLifecycleManager extends StatefulWidget {
  final Widget child;

  const AppLifecycleManager({
    super.key,
    required this.child,
  });

  @override
  State<AppLifecycleManager> createState() => _AppLifecycleManagerState();
}

class _AppLifecycleManagerState extends State<AppLifecycleManager>
    with WidgetsBindingObserver {
  bool _isCheckingVersion = false;
  bool _updateDialogShown = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    // Check version when app resumes from background
    if (state == AppLifecycleState.resumed) {
      _checkVersionOnResume();
    }
  }

  Future<void> _checkVersionOnResume() async {
    // Prevent multiple simultaneous checks
    if (_isCheckingVersion || _updateDialogShown) return;

    _isCheckingVersion = true;

    try {
      final versionDataSource = Injection.getVersionRemoteDataSource();
      final result = await versionDataSource.checkAppVersion();

      if (!mounted) {
        _isCheckingVersion = false;
        return;
      }

      if (result != null && result.updateRequired) {
        // Update is required - show blocking dialog
        _updateDialogShown = true;

        // Safe to use context here because we checked mounted
        // ignore: use_build_context_synchronously
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (dialogContext) => UpdateRequiredDialog(
            minimumVersion: result.minimumVersion,
            storeUrl: result.storeUrl,
          ),
        );
      }
    } catch (e) {
      // Silently fail - don't block the app on resume
      debugPrint('Version check on resume failed: $e');
    } finally {
      _isCheckingVersion = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
