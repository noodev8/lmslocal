import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/di/injection.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_event.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';

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
      child: Scaffold(
        body: BlocConsumer<AuthBloc, AuthState>(
          listener: (context, state) {
            if (state is AuthSessionExpiredState) {
              _notify(state.message);
            } else if (state is AuthError) {
              _notify(state.message);
            } else if (state is AuthAuthenticated) {
              Injection.getNotificationService().initialize();
              context.go('/dashboard');
            }
          },
          builder: (context, state) {
            final isLoading = state is AuthLoading;

            return SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 40),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Image.asset('assets/images/logo.png', height: 96),
                      ),
                      const SizedBox(height: 40),

                      Text('Welcome back', style: CouponTheme.eyebrow),
                      const SizedBox(height: 12),
                      Text('SIGN IN', style: CouponTheme.heading(48)),
                      const SizedBox(height: 16),
                      Text(
                        "Manage your competitions, or make this week's pick.",
                        style: CouponTheme.intro,
                      ),
                      const SizedBox(height: 32),

                      _Field(
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
                      const SizedBox(height: 20),

                      _Field(
                        label: 'Password',
                        child: TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          textInputAction: TextInputAction.done,
                          enabled: !isLoading,
                          style: CouponTheme.bodyText,
                          onFieldSubmitted: (_) => isLoading ? null : _handleLogin(),
                          decoration: InputDecoration(
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                color: CouponTheme.inkFade,
                                size: 20,
                              ),
                              tooltip: _obscurePassword
                                  ? 'Show password'
                                  : 'Hide password',
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
                      const SizedBox(height: 12),

                      Align(
                        alignment: Alignment.centerLeft,
                        child: _DottedLink(
                          label: 'Forgotten your password?',
                          onPressed: isLoading
                              ? null
                              : () => context.push('/forgot-password'),
                        ),
                      ),
                      const SizedBox(height: 28),

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
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  /// Notices are ink on stock-lit with an overprint rule down the side. The
  /// second ink means "eliminated" or "primary action" — an error set in it
  /// reads as emphasis rather than alarm.
  void _notify(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          duration: const Duration(seconds: 4),
        ),
      );
  }
}

/// A field label sitting above its input, matching the web's auth pages.
class _Field extends StatelessWidget {
  const _Field({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: CouponTheme.label),
        const SizedBox(height: 8),
        child,
      ],
    );
  }
}

/// Tertiary action: a label with a dotted underline, per design-system.md §6.
class _DottedLink extends StatelessWidget {
  const _DottedLink({required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onPressed,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
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
