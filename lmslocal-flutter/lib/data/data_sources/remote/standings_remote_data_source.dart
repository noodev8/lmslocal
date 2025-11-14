import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/models/standings_group_model.dart';
import 'package:lmslocal_flutter/data/models/standings_player_model.dart';
import 'package:lmslocal_flutter/data/models/round_history_model.dart';

/// Remote data source for standings-related API calls
class StandingsRemoteDataSource {
  final ApiClient _apiClient;

  StandingsRemoteDataSource({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  /// Get standings summary (groups only)
  /// Returns: competition info, round state, and groups list
  Future<StandingsSummaryResponse> getStandingsSummary(int competitionId) async {
    try {
      final response = await _apiClient.post(
        '/get-standings-summary',
        data: {'competition_id': competitionId},
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final competition = data['competition'] as Map<String, dynamic>?;
        final roundState = data['round_state'] as String? ?? '';
        final groups = (data['groups'] as List?)
                ?.map((e) => StandingsGroupModel.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [];

        return StandingsSummaryResponse(
          competitionName: competition?['name'] as String? ?? '',
          currentRound: competition?['current_round'] as int? ?? 0,
          competitionStatus: competition?['status'] as String? ?? '',
          roundState: roundState,
          groups: groups,
        );
      } else {
        final message = data['message'] as String? ?? 'Failed to fetch standings';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw NetworkFailure('Failed to fetch standings: ${e.toString()}');
    }
  }

  /// Get players for a specific standings group (paginated)
  /// Returns: players list and pagination info
  Future<StandingsGroupPlayersResponse> getStandingsGroup({
    required int competitionId,
    required String groupKey,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      final response = await _apiClient.post(
        '/get-standings-group',
        data: {
          'competition_id': competitionId,
          'group_key': groupKey,
          'page': page,
          'page_size': pageSize,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final players = (data['players'] as List?)
                ?.map((e) => StandingsPlayerModel.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [];

        final pagination = data['pagination'] as Map<String, dynamic>?;

        return StandingsGroupPlayersResponse(
          players: players,
          currentPage: pagination?['current_page'] as int? ?? 1,
          totalPages: pagination?['total_pages'] as int? ?? 1,
        );
      } else {
        final message = data['message'] as String? ?? 'Failed to fetch group players';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw NetworkFailure('Failed to fetch group players: ${e.toString()}');
    }
  }

  /// Get player history for a specific player
  /// Returns: list of round history
  Future<PlayerHistoryResponse> getPlayerHistory({
    required int competitionId,
    required int playerId,
  }) async {
    try {
      final response = await _apiClient.post(
        '/get-player-history',
        data: {
          'competition_id': competitionId,
          'player_id': playerId,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final history = (data['history'] as List?)
                ?.map((e) => RoundHistoryModel.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [];

        return PlayerHistoryResponse(history: history);
      } else {
        final message = data['message'] as String? ?? 'Failed to fetch player history';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw NetworkFailure('Failed to fetch player history: ${e.toString()}');
    }
  }

  /// Search players by name or email
  /// Returns: list of matching players
  Future<SearchPlayersResponse> searchPlayers({
    required int competitionId,
    required String searchTerm,
    int limit = 20,
  }) async {
    try {
      final response = await _apiClient.post(
        '/search-players',
        data: {
          'competition_id': competitionId,
          'search_term': searchTerm,
          'limit': limit,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final results = (data['results'] as List?)
                ?.map((e) => StandingsPlayerModel.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [];

        return SearchPlayersResponse(results: results);
      } else {
        final message = data['message'] as String? ?? 'Failed to search players';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw NetworkFailure('Failed to search players: ${e.toString()}');
    }
  }
}

/// Response class for standings summary
class StandingsSummaryResponse {
  final String competitionName;
  final int currentRound;
  final String competitionStatus;
  final String roundState;
  final List<StandingsGroupModel> groups;

  StandingsSummaryResponse({
    required this.competitionName,
    required this.currentRound,
    required this.competitionStatus,
    required this.roundState,
    required this.groups,
  });
}

/// Response class for standings group players
class StandingsGroupPlayersResponse {
  final List<StandingsPlayerModel> players;
  final int currentPage;
  final int totalPages;

  StandingsGroupPlayersResponse({
    required this.players,
    required this.currentPage,
    required this.totalPages,
  });
}

/// Response class for player history
class PlayerHistoryResponse {
  final List<RoundHistoryModel> history;

  PlayerHistoryResponse({
    required this.history,
  });
}

/// Response class for search players
class SearchPlayersResponse {
  final List<StandingsPlayerModel> results;

  SearchPlayersResponse({
    required this.results,
  });
}
