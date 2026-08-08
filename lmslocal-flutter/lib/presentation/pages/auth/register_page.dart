import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:lmslocal_flutter/core/di/injection.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_event.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';
import 'package:lmslocal_flutter/presentation/widgets/auth_shell.dart';

/// Register page.
///
/// Structure mirrors the web's `/register`, but not its intro copy: the web
/// sells to organisers ("twenty player places, free"), and this app is only
/// ever used by players.
class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _displayNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _acceptedTerms = false;
  bool _showTermsError = false;

  @override
  void dispose() {
    _displayNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _handleRegister() {
    final isFormValid = _formKey.currentState!.validate();

    if (!_acceptedTerms) {
      setState(() {
        _showTermsError = true;
      });
    }

    if (isFormValid && _acceptedTerms) {
      context.read<AuthBloc>().add(
            AuthRegisterRequested(
              displayName: _displayNameController.text.trim(),
              email: _emailController.text.trim(),
              password: _passwordController.text,
            ),
          );
    }
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  String? _validateDisplayName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Enter the name other players will see.';
    }
    final trimmed = value.trim();
    if (trimmed.length < 2) {
      return 'That is too short — use at least 2 characters.';
    }
    if (trimmed.length > 50) {
      return 'That is too long — use 50 characters or fewer.';
    }
    return null;
  }

  String? _validateEmail(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Enter your email address.';
    }
    if (!value.contains('@')) {
      return 'That does not look like an email address.';
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Choose a password.';
    }
    if (value.length < 6) {
      return 'Use at least 6 characters.';
    }
    return null;
  }

  String? _validateConfirmPassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Type your password again.';
    }
    if (value != _passwordController.text) {
      return 'These two do not match.';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthAuthenticated) {
          Injection.getNotificationService().initialize();
          context.go('/dashboard');
        }
      },
      builder: (context, state) {
        final isLoading = state is AuthLoading;
        final error = state is AuthError ? state.message : null;

        return Form(
          key: _formKey,
          child: AuthShell(
            showBack: true,
            eyebrow: 'Get started',
            title: 'Create your account',
            intro: 'One account joins you to any competition you are invited to.',
            children: [
              if (error != null) Notice(message: error),

              AuthField(
                label: 'Name',
                hint: 'What other players will see on the standings.',
                child: TextFormField(
                  controller: _displayNameController,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  enabled: !isLoading,
                  style: CouponTheme.bodyText,
                  validator: _validateDisplayName,
                ),
              ),

              AuthField(
                label: 'Email',
                child: TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  enabled: !isLoading,
                  style: CouponTheme.bodyText,
                  validator: _validateEmail,
                ),
              ),

              AuthField(
                label: 'Password',
                hint: 'At least 6 characters.',
                child: TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  textInputAction: TextInputAction.next,
                  enabled: !isLoading,
                  style: CouponTheme.bodyText,
                  decoration: InputDecoration(
                    suffixIcon: passwordToggle(
                      obscured: _obscurePassword,
                      onPressed: () =>
                          setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  validator: _validatePassword,
                ),
              ),

              AuthField(
                label: 'Confirm password',
                child: TextFormField(
                  controller: _confirmPasswordController,
                  obscureText: _obscureConfirmPassword,
                  textInputAction: TextInputAction.done,
                  enabled: !isLoading,
                  style: CouponTheme.bodyText,
                  decoration: InputDecoration(
                    suffixIcon: passwordToggle(
                      obscured: _obscureConfirmPassword,
                      onPressed: () => setState(
                        () => _obscureConfirmPassword = !_obscureConfirmPassword,
                      ),
                    ),
                  ),
                  validator: _validateConfirmPassword,
                ),
              ),

              _TermsTickBox(
                accepted: _acceptedTerms,
                showError: _showTermsError,
                enabled: !isLoading,
                onChanged: (value) => setState(() {
                  _acceptedTerms = value;
                  if (value) _showTermsError = false;
                }),
                onOpenTerms: () => _launchUrl('https://lmslocal.co.uk/terms'),
                onOpenPrivacy: () => _launchUrl('https://lmslocal.co.uk/privacy'),
              ),
              const SizedBox(height: 24),

              ElevatedButton(
                onPressed: isLoading ? null : _handleRegister,
                child: Text(
                  isLoading ? 'CREATING YOUR ACCOUNT…' : 'CREATE ACCOUNT',
                ),
              ),
              const SizedBox(height: 20),

              Center(
                child: DottedLink(
                  label: 'Already have an account? Sign in',
                  onPressed: isLoading ? null : () => context.pop(),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// A real tick box with a border, per design-system.md §6 — it reads as a form,
/// not as an icon list.
class _TermsTickBox extends StatelessWidget {
  const _TermsTickBox({
    required this.accepted,
    required this.showError,
    required this.enabled,
    required this.onChanged,
    required this.onOpenTerms,
    required this.onOpenPrivacy,
  });

  final bool accepted;
  final bool showError;
  final bool enabled;
  final ValueChanged<bool> onChanged;
  final VoidCallback onOpenTerms;
  final VoidCallback onOpenPrivacy;

  @override
  Widget build(BuildContext context) {
    final linkStyle = CouponTheme.bodyText.copyWith(
      decoration: TextDecoration.underline,
      decorationStyle: TextDecorationStyle.dotted,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 24,
              width: 24,
              child: Checkbox(
                value: accepted,
                onChanged: enabled ? (v) => onChanged(v ?? false) : null,
                activeColor: CouponTheme.ink,
                checkColor: CouponTheme.stockLit,
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.zero,
                ),
                side: BorderSide(
                  color: showError
                      ? CouponTheme.overprint
                      : CouponTheme.ink.withValues(alpha: 0.4),
                  width: 1.5,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: RichText(
                text: TextSpan(
                  style: CouponTheme.bodyText,
                  children: [
                    const TextSpan(text: 'I agree to the '),
                    TextSpan(
                      text: 'terms of service',
                      style: linkStyle,
                      recognizer: TapGestureRecognizer()..onTap = onOpenTerms,
                    ),
                    const TextSpan(text: ' and '),
                    TextSpan(
                      text: 'privacy policy',
                      style: linkStyle,
                      recognizer: TapGestureRecognizer()..onTap = onOpenPrivacy,
                    ),
                    const TextSpan(text: '.'),
                  ],
                ),
              ),
            ),
          ],
        ),
        // Says what to do, not just that something is wrong.
        if (showError)
          Padding(
            padding: const EdgeInsets.only(left: 36, top: 8),
            child: Text(
              'Tick the box to agree before creating your account.',
              style: CouponTheme.bodyText.copyWith(fontSize: 15),
            ),
          ),
      ],
    );
  }
}
