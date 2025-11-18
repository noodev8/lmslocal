import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';

/// Remote data source for user-related API calls
/// Handles profile updates, password changes, email preferences, and account deletion
class UserRemoteDataSource {
  final ApiClient _apiClient;

  UserRemoteDataSource({required ApiClient apiClient}) : _apiClient = apiClient;

  /// Update user profile (display name)
  /// Throws ServerFailure or AuthFailure on error
  Future<Map<String, dynamic>> updateProfile({
    required String displayName,
  }) async {
    try {
      final response = await _apiClient.post(
        '/update-profile',
        data: {
          'display_name': displayName,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        return data;
      } else {
        final message = data['message'] as String? ?? 'Failed to update profile';
        throw AuthFailure(message, code: returnCode);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure('Failed to update profile: ${e.toString()}');
    }
  }

  /// Change user password
  /// Throws ServerFailure or AuthFailure on error
  Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final response = await _apiClient.post(
        '/change-password',
        data: {
          'current_password': currentPassword,
          'new_password': newPassword,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        return data;
      } else {
        final message = data['message'] as String? ?? 'Failed to change password';
        throw AuthFailure(message, code: returnCode);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure('Failed to change password: ${e.toString()}');
    }
  }

  /// Get email notification preferences
  /// Throws ServerFailure or AuthFailure on error
  Future<Map<String, dynamic>> getEmailPreferences() async {
    try {
      final response = await _apiClient.post(
        '/get-email-preferences',
        data: {},
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        return data;
      } else {
        final message = data['message'] as String? ?? 'Failed to get email preferences';
        throw AuthFailure(message, code: returnCode);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure('Failed to get email preferences: ${e.toString()}');
    }
  }

  /// Update email notification preferences (batch)
  /// Throws ServerFailure or AuthFailure on error
  Future<Map<String, dynamic>> updateEmailPreferencesBatch({
    required List<Map<String, dynamic>> updates,
  }) async {
    try {
      final response = await _apiClient.post(
        '/update-email-preferences-batch',
        data: {
          'updates': updates,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        return data;
      } else {
        final message = data['message'] as String? ?? 'Failed to update email preferences';
        throw AuthFailure(message, code: returnCode);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure('Failed to update email preferences: ${e.toString()}');
    }
  }

  /// Delete user account
  /// Requires exact confirmation string "DELETE_MY_ACCOUNT"
  /// Throws ServerFailure or AuthFailure on error
  Future<Map<String, dynamic>> deleteAccount({
    required String confirmation,
  }) async {
    try {
      final response = await _apiClient.post(
        '/delete-account',
        data: {
          'confirmation': confirmation,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        return data;
      } else {
        final message = data['message'] as String? ?? 'Failed to delete account';
        throw AuthFailure(message, code: returnCode);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure('Failed to delete account: ${e.toString()}');
    }
  }

  /// Join competition using invite code or slug
  /// Throws ServerFailure or AuthFailure on error
  Future<Map<String, dynamic>> joinCompetitionByCode({
    required String competitionCode,
  }) async {
    try {
      final response = await _apiClient.post(
        '/join-competition-by-code',
        data: {
          'competition_code': competitionCode.trim().toUpperCase(),
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        return data;
      } else {
        final message = data['message'] as String? ?? 'Failed to join competition';
        throw AuthFailure(message, code: returnCode);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure('Failed to join competition: ${e.toString()}');
    }
  }

  /// Update player display name for a specific competition
  /// Pass null or empty string to reset to global display name
  /// Throws ServerFailure or AuthFailure on error
  Future<Map<String, dynamic>> updatePlayerDisplayName({
    required int competitionId,
    String? playerDisplayName,
  }) async {
    try {
      final response = await _apiClient.post(
        '/update-player-display-name',
        data: {
          'competition_id': competitionId,
          'player_display_name': playerDisplayName,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        return data;
      } else {
        final message = data['message'] as String? ?? 'Failed to update player display name';
        throw AuthFailure(message, code: returnCode);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure('Failed to update player display name: ${e.toString()}');
    }
  }
}
