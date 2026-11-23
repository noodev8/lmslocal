import 'package:equatable/equatable.dart';
import 'package:lmslocal_flutter/domain/entities/user.dart';

/// Base class for authentication states
abstract class AuthState extends Equatable {
  const AuthState();

  // runtimeType is a prop because Equatable 3 stopped comparing it, and Bloc
  // drops an emit equal to the current state. Without it every field-less state
  // is equal to every other: AuthInitial -> AuthUnauthenticated at startup would
  // be swallowed and the app would sit on the splash screen. Subclasses add
  // their fields with `...super.props`.
  @override
  List<Object?> get props => [runtimeType];
}

/// Initial state - checking authentication status
class AuthInitial extends AuthState {
  const AuthInitial();
}

/// Loading state - authentication operation in progress
class AuthLoading extends AuthState {
  const AuthLoading();
}

/// Authenticated state - user is logged in
class AuthAuthenticated extends AuthState {
  final User user;
  final String token;

  const AuthAuthenticated({
    required this.user,
    required this.token,
  });

  @override
  List<Object?> get props => [...super.props, user, token];
}

/// Unauthenticated state - user is not logged in
class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

/// Error state - authentication operation failed
class AuthError extends AuthState {
  final String message;

  const AuthError({required this.message});

  @override
  List<Object?> get props => [...super.props, message];
}

/// Forgot password success state
class AuthForgotPasswordSuccess extends AuthState {
  final String message;

  const AuthForgotPasswordSuccess({required this.message});

  @override
  List<Object?> get props => [...super.props, message];
}

/// Session expired state - 401 from API
class AuthSessionExpiredState extends AuthState {
  final String message;

  const AuthSessionExpiredState({required this.message});

  @override
  List<Object?> get props => [...super.props, message];
}
