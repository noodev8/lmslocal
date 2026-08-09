import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/di/injection.dart';
import 'package:lmslocal_flutter/core/router/pending_destination.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_event.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';
import 'package:lmslocal_flutter/presentation/widgets/auth_shell.dart';

/// Login page.
///
/// Mirrors the web's `/login`, which is already on the coupon system — same
/// eyebrow, title, intro and field labels, so a player who met the form in a
/// browser meets the same one here.
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() {
    if (_formKey.currentState!.validate()) {
      context.read<AuthBloc>().add(
            AuthLoginRequested(
              email: _emailController.text.trim(),
              password: _passwordController.text,
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false, // Prevent back button on login screen
      child: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthAuthenticated) {
            Injection.getNotificationService().initialize();
            // A join link or a tapped notification that arrived while signed out is
            // resumed here rather than dropped. The web keeps its target in the URL
            // across a sign-in; in the app this holder is the only thing carrying it.
            context.go(PendingDestination.take() ?? '/dashboard');
          }
        },
        builder: (context, state) {
          final isLoading = state is AuthLoading;
          final error = state is AuthError
              ? state.message
              : state is AuthSessionExpiredState
                  ? state.message
                  : null;

          return Form(
            key: _formKey,
            child: AuthShell(
              eyebrow: 'Welcome back',
              title: 'Sign in',
              intro: "Pick up where you left off, or make this week's pick.",
              children: [
                if (error != null) Notice(message: error),

                AuthField(
                  label: 'Email',
                  child: TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    enabled: !isLoading,
                    style: CouponTheme.bodyText,
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Enter your email address.';
                      }
                      if (!value.contains('@')) {
                        return 'That does not look like an email address.';
                      }
                      return null;
                    },
                  ),
                ),

                AuthField(
                  label: 'Password',
                  child: TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    textInputAction: TextInputAction.done,
                    enabled: !isLoading,
                    style: CouponTheme.bodyText,
                    onFieldSubmitted: (_) => isLoading ? null : _handleLogin(),
                    decoration: InputDecoration(
                      suffixIcon: passwordToggle(
                        obscured: _obscurePassword,
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Enter your password.';
                      }
                      return null;
                    },
                  ),
                ),

                Align(
                  alignment: Alignment.centerLeft,
                  child: DottedLink(
                    label: 'Forgotten your password?',
                    onPressed: isLoading
                        ? null
                        : () => context.push('/forgot-password'),
                  ),
                ),
                const SizedBox(height: 20),

                ElevatedButton(
                  onPressed: isLoading ? null : _handleLogin,
                  child: Text(isLoading ? 'SIGNING YOU IN…' : 'SIGN IN'),
                ),
                const SizedBox(height: 32),

                Divider(color: CouponTheme.ink.withValues(alpha: 0.3)),
                const SizedBox(height: 20),

                Text('New to LMS Local?', style: CouponTheme.bodyText),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed:
                      isLoading ? null : () => context.push('/register'),
                  child: const Text('CREATE ACCOUNT'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
