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

  /// Public lookup of a competition from its invite code, so the join screen can show a
  /// player what they are joining before asking them to commit to it.
  ///
  /// Returns the raw response rather than throwing on a non-SUCCESS code, because every
  /// code this route returns is a state the screen has to render:
  /// COMPETITION_NOT_FOUND (typo, or already started - deliberately indistinguishable) and
  /// COMPETITION_FULL (the one closed state a player can act on, and the only one that
  /// names the organiser). See §4.3 of docs/player-onboarding.md.
  Future<Map<String, dynamic>> getCompetitionByCode({
    required String competitionCode,
  }) async {
    try {
      final response = await _apiClient.post(
        '/get-competition-by-code',
        data: {
          'competition_code': competitionCode.trim().toUpperCase(),
        },
      );

      return response.data as Map<String, dynamic>;
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure('Failed to look up competition: ${e.toString()}');
    }
  }

  /// Whether the signed-in player is already in the competition behind this code.
  ///
  /// Kept separate from the lookup above for the reason the route's own header gives:
  /// the lookup is deliberately unauthenticated and deliberately silent, membership is
  /// meaningless without an identity. Fired alongside the lookup, not after it.
  Future<Map<String, dynamic>> getJoinStatus({
    required String competitionCode,
  }) async {
    try {
      final response = await _apiClient.post(
        '/get-join-status',
        data: {
          'competition_code': competitionCode.trim().toUpperCase(),
        },
      );

      return response.data as Map<String, dynamic>;
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure('Failed to check membership: ${e.toString()}');
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
