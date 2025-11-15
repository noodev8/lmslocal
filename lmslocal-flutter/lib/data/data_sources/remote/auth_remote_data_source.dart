import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/models/auth_result_model.dart';

/// Authentication remote data source
/// Handles API calls for authentication operations
class AuthRemoteDataSource {
  final ApiClient _apiClient;

  AuthRemoteDataSource(this._apiClient);

  /// Login with email and password
  /// Throws ServerFailure or AuthFailure on error
  Future<AuthResultModel> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _apiClient.post(
        '/login',
        data: {
          'email': email,
          'password': password,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        return AuthResultModel.fromJson(data);
      } else {
        // API returned error response
        final message = data['message'] as String? ?? 'Login failed';
        throw AuthFailure(message, code: returnCode);
      }
    } on DioException catch (e) {
      if (e.type == DioExceptionType.cancel) {
        // This is our custom 401 handling - token expired
        throw const AuthFailure('Your session has expired. Please log in again.');
      } else if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw const NetworkFailure('Connection timeout. Please check your internet connection.');
      } else if (e.type == DioExceptionType.connectionError) {
        throw const NetworkFailure('Unable to connect to server. Please check your internet connection.');
      } else {
        throw ServerFailure(e.message ?? 'Network error occurred');
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure('Unexpected error: ${e.toString()}');
    }
  }

  /// Register new user account
  /// NOTE: Register API doesn't return a token, so we auto-login after successful registration
  /// Throws ServerFailure or AuthFailure on error
  Future<AuthResultModel> register({
    required String displayName,
    required String email,
    required String password,
  }) async {
    try {
      final response = await _apiClient.post(
        '/register',
        data: {
          'display_name': displayName,
          'email': email,
          'password': password,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        // Registration successful! Now auto-login to get JWT token
        debugPrint('✅ Registration successful, auto-logging in...');
        return await login(email: email, password: password);
      } else {
        // API returned error response
        final message = data['message'] as String? ?? 'Registration failed';
        throw AuthFailure(message, code: returnCode);
      }
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw const NetworkFailure('Connection timeout. Please check your internet connection.');
      } else if (e.type == DioExceptionType.connectionError) {
        throw const NetworkFailure('Unable to connect to server. Please check your internet connection.');
      } else {
        throw ServerFailure(e.message ?? 'Network error occurred');
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure('Unexpected error: ${e.toString()}');
    }
  }

  /// Request password reset
  /// Throws ServerFailure on error
  Future<String> forgotPassword({
    required String email,
  }) async {
    try {
      final response = await _apiClient.post(
        '/forgot-password',
        data: {
          'email': email,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        return data['message'] as String? ??
            'If an account with this email exists, a password reset link has been sent';
      } else {
        // API returned error response
        final message = data['message'] as String? ?? 'Password reset request failed';
        throw ServerFailure(message, code: returnCode);
      }
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw const NetworkFailure('Connection timeout. Please check your internet connection.');
      } else if (e.type == DioExceptionType.connectionError) {
        throw const NetworkFailure('Unable to connect to server. Please check your internet connection.');
      } else {
        throw ServerFailure(e.message ?? 'Network error occurred');
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure('Unexpected error: ${e.toString()}');
    }
  }
}
