import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/di/injection.dart';
import 'package:lmslocal_flutter/core/router/pending_destination.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';
import 'package:lmslocal_flutter/presentation/widgets/update_required_dialog.dart';

/// Static splash screen with the LMS Local badge.
/// Shows while checking authentication status (minimum 2 seconds).
class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  bool _hasNavigated = false;
  bool _minSplashTimeElapsed = false;
  bool _versionCheckComplete = false;
  bool _updateRequired = false;

  @override
  void initState() {
    super.initState();
    _startSplashTimer();
    _checkAppVersion();
  }

  /// Runs before anything else touches the API, so a build the server has
  /// retired asks for an update rather than failing its way through the app.
  Future<void> _checkAppVersion() async {
    final result =
        await Injection.getVersionRemoteDataSource().checkAppVersion();

    if (!mounted) return;

    setState(() {
      _versionCheckComplete = true;
      _updateRequired = result != null;
    });

    if (result != null) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => UpdateRequiredDialog(storeUrl: result.storeUrl),
      );
      return;
    }

    _tryNavigate(context.read<AuthBloc>().state);
  }

  Future<void> _startSplashTimer() async {
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    setState(() {
      _minSplashTimeElapsed = true;
    });

    // Check current auth state after the timer, in case the auth check
    // finished before the listener was set up.
    _tryNavigate(context.read<AuthBloc>().state);
  }

  void _handleAuthStateChange(BuildContext context, AuthState state) {
    _tryNavigate(state);
  }

  void _tryNavigate(AuthState state) {
    // The update dialog is terminal — there is nowhere to go from a build the
    // server will not serve.
    if (_updateRequired) return;

    if (!_minSplashTimeElapsed || !_versionCheckComplete || _hasNavigated) {
      return;
    }

    // Only navigate on final states, not loading or initial.
    if (state is! AuthAuthenticated && state is! AuthUnauthenticated) return;

    _hasNavigated = true;

    if (state is AuthAuthenticated) {
      Injection.getNotificationService().initialize();
      // A notification that started the app from cold left its destination here, because
      // it resolved before there was a session to open it with. Spending it now is what
      // stops a cold-start tap landing on the dashboard instead of what it was about.
      context.go(PendingDestination.take() ?? '/dashboard');
    } else if (state is AuthUnauthenticated) {
      // Any pending destination is deliberately left in place — the login page spends it
      // once there is a session, so the tap still finishes where it was aimed.
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: _handleAuthStateChange,
      child: Scaffold(
        // Matches @color/splash_background in the native launch theme, so the
        // handover from the Android window to Flutter's first frame is invisible.
        backgroundColor: CouponTheme.stock,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset(
                'assets/images/logo.png',
                width: 200,
                height: 200,
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 1.5,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    CouponTheme.inkFade,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
