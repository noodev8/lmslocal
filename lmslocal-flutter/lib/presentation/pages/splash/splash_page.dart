import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';

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

  @override
  void initState() {
    super.initState();
    _startSplashTimer();
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
    // Only navigate if minimum splash time has elapsed and we haven't navigated yet
    if (!_minSplashTimeElapsed || _hasNavigated) return;

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
        backgroundColor: AppConstants.primaryNavy,
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
            const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(
                AppConstants.primaryWhite,
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }
}
