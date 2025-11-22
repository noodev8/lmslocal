import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/di/injection.dart';
import 'package:lmslocal_flutter/core/theme/game_theme.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';
import 'package:lmslocal_flutter/presentation/widgets/update_required_dialog.dart';

/// Static splash screen with LMS Local logo
/// Shows while checking authentication status (minimum 2 seconds)
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

  /// Check if app version meets minimum requirements
  Future<void> _checkAppVersion() async {
    try {
      final versionDataSource = Injection.getVersionRemoteDataSource();
      final result = await versionDataSource.checkAppVersion();

      if (!mounted) return;

      if (result != null && result.updateRequired) {
        // Update is required - show blocking dialog
        setState(() {
          _updateRequired = true;
          _versionCheckComplete = true;
        });

        // Show update required dialog (blocking, cannot dismiss)
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => UpdateRequiredDialog(
            minimumVersion: result.minimumVersion,
            storeUrl: result.storeUrl,
          ),
        );
      } else {
        // No update required or error - continue normally
        setState(() {
          _versionCheckComplete = true;
        });
        _tryNavigate(context.read<AuthBloc>().state);
      }
    } catch (e) {
      // Error checking version - don't block the app
      debugPrint('Version check failed: $e');
      if (!mounted) return;
      setState(() {
        _versionCheckComplete = true;
      });
      _tryNavigate(context.read<AuthBloc>().state);
    }
  }

  Future<void> _startSplashTimer() async {
    // Show splash for minimum 2 seconds
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    setState(() {
      _minSplashTimeElapsed = true;
    });

    // Check current auth state after timer completes
    // (in case auth check finished before listener was set up)
    _tryNavigate(context.read<AuthBloc>().state);
  }

  void _handleAuthStateChange(BuildContext context, AuthState state) {
    _tryNavigate(state);
  }

  void _tryNavigate(AuthState state) {
    // Don't navigate if update is required - user must update first
    if (_updateRequired) return;

    // Only navigate if minimum splash time has elapsed, version check complete, and we haven't navigated yet
    if (!_minSplashTimeElapsed || !_versionCheckComplete || _hasNavigated) return;

    // Only navigate on final states (not loading or initial)
    if (state is! AuthAuthenticated && state is! AuthUnauthenticated) return;

    _hasNavigated = true;

    // Navigate based on auth state
    if (state is AuthAuthenticated) {
      context.go('/dashboard');
    } else if (state is AuthUnauthenticated) {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: _handleAuthStateChange,
      child: Scaffold(
        backgroundColor: GameTheme.background,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // LMS Local Logo
              Image.asset(
                'assets/images/logo.png',
                width: 200,
                height: 200,
              ),
              const SizedBox(height: 24),
              // Loading indicator
              CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(
                  GameTheme.glowCyan,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
