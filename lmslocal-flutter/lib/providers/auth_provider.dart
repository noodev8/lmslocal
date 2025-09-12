import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/cached_api_service.dart';

// Auth state
class AuthState {
  final User? user;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.user,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    User? user,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }

  bool get isLoggedIn => user != null;
}

// Auth notifier
class AuthNotifier extends StateNotifier<AuthState> {
  final CachedApiService _apiService;

  AuthNotifier(this._apiService) : super(const AuthState(isLoading: true)) {
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    try {
      final isLoggedIn = await _apiService.isLoggedIn();
      if (isLoggedIn) {
        final user = await _apiService.getCurrentUser();
        if (user != null) {
          state = state.copyWith(user: user, isLoading: false);
          return;
        }
      }
      // No valid auth found
      state = state.copyWith(isLoading: false);
    } catch (e) {
      // Auth check failed
      state = state.copyWith(isLoading: false, error: 'Failed to check authentication');
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);
    
    try {
      final response = await _apiService.login(email, password);
      
      if (response.isSuccess) {
        state = state.copyWith(
          user: response.user,
          isLoading: false,
        );
        return true;
      } else {
        state = state.copyWith(
          isLoading: false,
          error: response.message ?? 'Login failed',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Network error: $e',
      );
      return false;
    }
  }

  Future<bool> register(String email, String password, String displayName) async {
    state = state.copyWith(isLoading: true, clearError: true);
    
    try {
      final response = await _apiService.register(email, password, displayName);
      
      if (response.isSuccess) {
        state = state.copyWith(
          user: response.user,
          isLoading: false,
        );
        return true;
      } else {
        state = state.copyWith(
          isLoading: false,
          error: response.message ?? 'Registration failed',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Network error: $e',
      );
      return false;
    }
  }

  Future<void> logout() async {
    await _apiService.logout();
    // Clear all cached data on logout
    await _apiService.clearAllCache();
    state = const AuthState();
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }

  /// Update user profile data after successful profile update
  void updateUserProfile(String displayName) {
    if (state.user != null) {
      final updatedUser = User(
        id: state.user!.id,
        email: state.user!.email,
        displayName: displayName,
      );
      state = state.copyWith(user: updatedUser);
    }
  }
}

// Provider
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(CachedApiService.instance);
});