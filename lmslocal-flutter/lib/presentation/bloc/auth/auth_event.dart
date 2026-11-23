import 'package:equatable/equatable.dart';

/// Base class for authentication events
abstract class AuthEvent extends Equatable {
  const AuthEvent();

  // runtimeType is a prop because Equatable 3 stopped comparing it; see
  // AuthState. Subclasses add their fields with `...super.props`.
  @override
  List<Object?> get props => [runtimeType];
}

/// Check if user is authenticated (app startup)
class AuthCheckRequested extends AuthEvent {
  const AuthCheckRequested();
}

/// Login with email and password
class AuthLoginRequested extends AuthEvent {
  final String email;
  final String password;

  const AuthLoginRequested({
    required this.email,
    required this.password,
  });

  @override
  List<Object?> get props => [...super.props, email, password];
}

/// Register new user account
class AuthRegisterRequested extends AuthEvent {
  final String displayName;
  final String email;
  final String password;

  const AuthRegisterRequested({
    required this.displayName,
    required this.email,
    required this.password,
  });

  @override
  List<Object?> get props => [...super.props, displayName, email, password];
}

/// Forgot password request
class AuthForgotPasswordRequested extends AuthEvent {
  final String email;

  const AuthForgotPasswordRequested({required this.email});

  @override
  List<Object?> get props => [...super.props, email];
}

/// Logout current user
class AuthLogoutRequested extends AuthEvent {
  const AuthLogoutRequested();
}

/// Reset auth state to unauthenticated (for clearing success/error states)
class AuthStateReset extends AuthEvent {
  const AuthStateReset();
}

/// Session expired (401 from API)
class AuthSessionExpired extends AuthEvent {
  final String message;

  const AuthSessionExpired({required this.message});

  @override
  List<Object?> get props => [...super.props, message];
}
