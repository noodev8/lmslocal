import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_event.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';
import 'package:lmslocal_flutter/presentation/widgets/auth_shell.dart';

/// Forgot password page. Mirrors the web's `/forgot-password`, including the
/// way success replaces the form entirely rather than sitting above it.
class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Clear any success or error left over from a previous visit.
    context.read<AuthBloc>().add(const AuthStateReset());
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  void _handleSubmit() {
    if (_formKey.currentState!.validate()) {
      context.read<AuthBloc>().add(
            AuthForgotPasswordRequested(email: _emailController.text.trim()),
          );
    }
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

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        final isLoading = state is AuthLoading;
        final error = state is AuthError ? state.message : null;

        if (state is AuthForgotPasswordSuccess) {
          return AuthShell(
            showBack: true,
            eyebrow: 'On its way',
            title: 'Check your email',
            intro: 'We have sent you a link to set a new password. '
                'It is good for one use.',
            children: [
              OutlinedButton(
                onPressed: () => context.go('/login'),
                child: const Text('BACK TO SIGN IN'),
              ),
            ],
          );
        }

        return Form(
          key: _formKey,
          child: AuthShell(
            showBack: true,
            eyebrow: 'Password reset',
            title: 'Forgotten your password',
            intro: 'Give us the email you signed up with and we will send you '
                'a link to set a new one.',
            children: [
              if (error != null) Notice(message: error),

              AuthField(
                label: 'Email',
                child: TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.done,
                  enabled: !isLoading,
                  style: CouponTheme.bodyText,
                  onFieldSubmitted: (_) => isLoading ? null : _handleSubmit(),
                  validator: _validateEmail,
                ),
              ),
              const SizedBox(height: 8),

              ElevatedButton(
                onPressed: isLoading ? null : _handleSubmit,
                child: Text(isLoading ? 'SENDING…' : 'SEND RESET LINK'),
              ),
              const SizedBox(height: 20),

              Center(
                child: DottedLink(
                  label: 'Remembered it? Sign in',
                  onPressed: isLoading ? null : () => context.go('/login'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
