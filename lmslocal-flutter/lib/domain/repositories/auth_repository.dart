import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/domain/entities/auth_result.dart';
import 'package:lmslocal_flutter/domain/entities/user.dart';

/// Authentication repository interface
/// Defines contract for authentication operations
abstract class AuthRepository {
  /// Login with email and password
  /// Returns AuthResult on success, Failure on error
  Future<({AuthResult? result, Failure? failure})> login({
    required String email,
    required String password,
  });

  /// Register new user account
  /// Returns AuthResult on success, Failure on error
  Future<({AuthResult? result, Failure? failure})> register({
    required String displayName,
    required String email,
    required String password,
  });

  /// Request password reset
  /// Returns success message on success, Failure on error
  Future<({String? message, Failure? failure})> forgotPassword({
    required String email,
  });

  /// Check if user is currently authenticated
  /// Returns true if valid token exists
  Future<bool> isAuthenticated();

  /// Get currently authenticated user
  /// Returns User if authenticated, null otherwise
  Future<User?> getCurrentUser();

  /// Logout current user (clear token and cached data)
  Future<void> logout();
}
