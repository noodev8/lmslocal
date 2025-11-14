import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lmslocal_flutter/domain/repositories/auth_repository.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_event.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_state.dart';

/// Authentication BLoC
/// Manages authentication state and handles auth events
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository _authRepository;

  AuthBloc({required AuthRepository authRepository})
      : _authRepository = authRepository,
        super(const AuthInitial()) {
    // Register event handlers
    on<AuthCheckRequested>(_onAuthCheckRequested);
    on<AuthLoginRequested>(_onAuthLoginRequested);
    on<AuthRegisterRequested>(_onAuthRegisterRequested);
    on<AuthForgotPasswordRequested>(_onAuthForgotPasswordRequested);
    on<AuthLogoutRequested>(_onAuthLogoutRequested);
    on<AuthSessionExpired>(_onAuthSessionExpired);
  }

  /// Check if user is authenticated on app startup
  Future<void> _onAuthCheckRequested(
    AuthCheckRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());

    final isAuthenticated = await _authRepository.isAuthenticated();

    if (isAuthenticated) {
      final user = await _authRepository.getCurrentUser();
      if (user != null) {
        emit(AuthAuthenticated(user: user, token: ''));
      } else {
        // Token exists but no user cached - logout and start fresh
        await _authRepository.logout();
        emit(const AuthUnauthenticated());
      }
    } else {
      emit(const AuthUnauthenticated());
    }
  }

  /// Handle login request
  Future<void> _onAuthLoginRequested(
    AuthLoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());

    final result = await _authRepository.login(
      email: event.email,
      password: event.password,
    );

    if (result.result != null) {
      // Login successful
      final authResult = result.result!;
      emit(AuthAuthenticated(
        user: authResult.user,
        token: authResult.token,
      ));
    } else {
      // Login failed
      emit(AuthError(message: result.failure?.message ?? 'Login failed'));
    }
  }

  /// Handle register request
  Future<void> _onAuthRegisterRequested(
    AuthRegisterRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());

    final result = await _authRepository.register(
      displayName: event.displayName,
      email: event.email,
      password: event.password,
    );

    if (result.result != null) {
      // Registration successful
      final authResult = result.result!;
      emit(AuthAuthenticated(
        user: authResult.user,
        token: authResult.token,
      ));
    } else {
      // Registration failed
      emit(AuthError(message: result.failure?.message ?? 'Registration failed'));
    }
  }

  /// Handle forgot password request
  Future<void> _onAuthForgotPasswordRequested(
    AuthForgotPasswordRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());

    final result = await _authRepository.forgotPassword(email: event.email);

    if (result.message != null) {
      // Request successful
      emit(AuthForgotPasswordSuccess(message: result.message!));
    } else {
      // Request failed
      emit(AuthError(message: result.failure?.message ?? 'Password reset request failed'));
    }
  }

  /// Handle logout request
  Future<void> _onAuthLogoutRequested(
    AuthLogoutRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());

    await _authRepository.logout();

    emit(const AuthUnauthenticated());
  }

  /// Handle session expired (401 from API)
  Future<void> _onAuthSessionExpired(
    AuthSessionExpired event,
    Emitter<AuthState> emit,
  ) async {
    // Clear auth data
    await _authRepository.logout();

    // Emit session expired state with message
    emit(AuthSessionExpiredState(message: event.message));

    // Immediately transition to unauthenticated
    emit(const AuthUnauthenticated());
  }
}
