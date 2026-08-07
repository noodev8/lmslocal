import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/di/injection.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';

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

  @override
  void initState() {
    super.initState();
    _startSplashTimer();
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
    if (!_minSplashTimeElapsed || _hasNavigated) return;

    // Only navigate on final states, not loading or initial.
    if (state is! AuthAuthenticated && state is! AuthUnauthenticated) return;

    _hasNavigated = true;

    if (state is AuthAuthenticated) {
      Injection.getNotificationService().initialize();
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
