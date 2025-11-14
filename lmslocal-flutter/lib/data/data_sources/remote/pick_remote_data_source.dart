import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/models/fixture_model.dart';
import 'package:lmslocal_flutter/data/models/allowed_team_model.dart';

/// Remote data source for pick-related API calls
class PickRemoteDataSource {
  final ApiClient _apiClient;

  PickRemoteDataSource({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  /// Get fixtures for a specific round
  Future<List<FixtureModel>> getFixtures(int roundId) async {
    try {
      final response = await _apiClient.post(
        '/get-fixtures',
        data: {'round_id': roundId},
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final fixtures = (data['fixtures'] as List)
            .map((e) => FixtureModel.fromJson(e as Map<String, dynamic>))
            .toList();
        return fixtures;
      } else {
        final message = data['message'] as String? ?? 'Failed to fetch fixtures';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw NetworkFailure('Failed to fetch fixtures: ${e.toString()}');
    }
  }

  /// Get allowed teams for a competition (teams player can still pick)
  Future<List<AllowedTeamModel>> getAllowedTeams(int competitionId) async {
    try {
      final response = await _apiClient.post(
        '/get-allowed-teams',
        data: {'competition_id': competitionId},
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final teams = (data['allowed_teams'] as List)
            .map((e) => AllowedTeamModel.fromJson(e as Map<String, dynamic>))
            .toList();
        return teams;
      } else {
        final message =
            data['message'] as String? ?? 'Failed to fetch allowed teams';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw NetworkFailure('Failed to fetch allowed teams: ${e.toString()}');
    }
  }

  /// Get current pick for a round
  /// Returns the team short name if pick exists, null otherwise
  Future<String?> getCurrentPick(int roundId) async {
    try {
      final response = await _apiClient.post(
        '/get-current-pick',
        data: {'round_id': roundId},
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final pick = data['pick'] as Map<String, dynamic>?;
        if (pick != null) {
          return pick['team'] as String?;
        }
        return null;
      } else if (returnCode == 'NO_PICK') {
        return null;
      } else {
        final message =
            data['message'] as String? ?? 'Failed to fetch current pick';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw NetworkFailure('Failed to fetch current pick: ${e.toString()}');
    }
  }

  /// Set pick for a fixture
  /// position: 'home' or 'away'
  /// Returns true if round locked after this pick (last player picked)
  Future<bool> setPick(int fixtureId, String position) async {
    try {
      final response = await _apiClient.post(
        '/set-pick',
        data: {
          'fixture_id': fixtureId,
          'team': position,  // API expects 'team', not 'position'
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        // Check if this pick triggered auto-lock
        final roundLocked = data['round_locked'] as bool? ?? false;
        return roundLocked;
      } else {
        final message = data['message'] as String? ?? 'Failed to set pick';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw NetworkFailure('Failed to set pick: ${e.toString()}');
    }
  }

  /// Remove current pick (unselect)
  Future<void> unselectPick(int roundId) async {
    try {
      final response = await _apiClient.post(
        '/unselect-pick',
        data: {'round_id': roundId},
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode != AppConstants.successCode) {
        final message = data['message'] as String? ?? 'Failed to remove pick';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw NetworkFailure('Failed to remove pick: ${e.toString()}');
    }
  }

  /// Get pick counts for all teams in a round
  /// Returns map of team short names to pick counts
  Future<Map<String, int>> getPickCounts(int roundId) async {
    try {
      final response = await _apiClient.post(
        '/get-fixture-pick-count',
        data: {'round_id': roundId},
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final pickCounts = data['pick_counts'] as Map<String, dynamic>;
        return pickCounts.map((key, value) => MapEntry(key, value as int));
      } else {
        final message =
            data['message'] as String? ?? 'Failed to fetch pick counts';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw NetworkFailure('Failed to fetch pick counts: ${e.toString()}');
    }
  }
}
