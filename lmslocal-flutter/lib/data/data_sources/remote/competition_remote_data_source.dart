import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/models/round_info_model.dart';
import 'package:lmslocal_flutter/data/models/pick_statistics_model.dart';
import 'package:lmslocal_flutter/data/models/round_statistics_model.dart';
import 'package:lmslocal_flutter/data/models/unpicked_player_model.dart';

/// Remote data source for competition-related API calls
/// Includes caching for offline support and performance
class CompetitionRemoteDataSource {
  final ApiClient _apiClient;
  final SharedPreferences _prefs;

  static const int _roundsCacheDurationMinutes = 15;
  static const int _pickStatsCacheDurationMinutes = 60;
  static const int _roundStatsCacheDurationMinutes = 15;

  CompetitionRemoteDataSource({
    required ApiClient apiClient,
    required SharedPreferences prefs,
  })  : _apiClient = apiClient,
        _prefs = prefs;

  /// Get all rounds for a competition
  /// Returns cached data if fresh, otherwise fetches from API
  Future<List<RoundInfoModel>> getRounds({
    required int competitionId,
    bool forceRefresh = false,
  }) async {
    final cacheKey = 'competition_rounds_$competitionId';
    final cacheTimeKey = '${cacheKey}_time';

    // Check cache first unless force refresh
    if (!forceRefresh) {
      final cachedData = await _getCachedData<List<RoundInfoModel>>(
        cacheKey,
        cacheTimeKey,
        _roundsCacheDurationMinutes,
        (json) => (jsonDecode(json) as List)
            .map((e) => RoundInfoModel.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
      if (cachedData != null) {
        return cachedData;
      }
    }

    // Fetch from API
    try {
      final response = await _apiClient.post(
        '/get-rounds',
        data: {'competition_id': competitionId},
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final rounds = (data['rounds'] as List)
            .map((e) => RoundInfoModel.fromJson(e as Map<String, dynamic>))
            .toList();

        // Cache the response
        await _cacheData(cacheKey, cacheTimeKey, rounds);

        return rounds;
      } else {
        final message = data['message'] as String? ?? 'Failed to fetch rounds';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;

      // If network error, try to return stale cache
      final cachedData = await _getCachedData<List<RoundInfoModel>>(
        cacheKey,
        cacheTimeKey,
        _roundsCacheDurationMinutes,
        (json) => (jsonDecode(json) as List)
            .map((e) => RoundInfoModel.fromJson(e as Map<String, dynamic>))
            .toList(),
        ignoreExpiry: true,
      );
      if (cachedData != null) {
        return cachedData;
      }

      throw NetworkFailure('Failed to fetch rounds: ${e.toString()}');
    }
  }

  /// Get pick statistics for a specific round
  /// Shows how many players have made picks
  Future<PickStatisticsModel> getPickStatistics({
    required int competitionId,
    required int roundNumber,
    bool forceRefresh = false,
  }) async {
    final cacheKey = 'pick_stats_${competitionId}_$roundNumber';
    final cacheTimeKey = '${cacheKey}_time';

    // Check cache first unless force refresh
    if (!forceRefresh) {
      final cachedData = await _getCachedData<PickStatisticsModel>(
        cacheKey,
        cacheTimeKey,
        _pickStatsCacheDurationMinutes,
        (json) => PickStatisticsModel.fromJson(
            jsonDecode(json) as Map<String, dynamic>),
      );
      if (cachedData != null) {
        return cachedData;
      }
    }

    // Fetch from API
    try {
      final response = await _apiClient.post(
        '/get-pick-statistics',
        data: {
          'competition_id': competitionId,
          'round_number': roundNumber,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final stats = PickStatisticsModel.fromJson(data);

        // Cache the response
        await _cacheData(cacheKey, cacheTimeKey, stats);

        return stats;
      } else {
        final message =
            data['message'] as String? ?? 'Failed to fetch pick statistics';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;

      // If network error, try to return stale cache
      final cachedData = await _getCachedData<PickStatisticsModel>(
        cacheKey,
        cacheTimeKey,
        _pickStatsCacheDurationMinutes,
        (json) => PickStatisticsModel.fromJson(
            jsonDecode(json) as Map<String, dynamic>),
        ignoreExpiry: true,
      );
      if (cachedData != null) {
        return cachedData;
      }

      throw NetworkFailure('Failed to fetch pick statistics: ${e.toString()}');
    }
  }

  /// Get round statistics showing wins/losses/eliminations
  /// Used for completed or locked rounds
  Future<RoundStatisticsModel> getRoundStatistics({
    required int competitionId,
    required int roundNumber,
    bool forceRefresh = false,
  }) async {
    final cacheKey = 'round_stats_${competitionId}_$roundNumber';
    final cacheTimeKey = '${cacheKey}_time';

    // Check cache first unless force refresh
    if (!forceRefresh) {
      final cachedData = await _getCachedData<RoundStatisticsModel>(
        cacheKey,
        cacheTimeKey,
        _roundStatsCacheDurationMinutes,
        (json) => RoundStatisticsModel.fromJson(
            jsonDecode(json) as Map<String, dynamic>),
      );
      if (cachedData != null) {
        return cachedData;
      }
    }

    // Fetch from API
    try {
      final response = await _apiClient.post(
        '/get-round-statistics',
        data: {
          'competition_id': competitionId,
          'round_number': roundNumber,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final stats = RoundStatisticsModel.fromJson(data);

        // Cache the response
        await _cacheData(cacheKey, cacheTimeKey, stats);

        return stats;
      } else {
        final message =
            data['message'] as String? ?? 'Failed to fetch round statistics';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;

      // If network error, try to return stale cache
      final cachedData = await _getCachedData<RoundStatisticsModel>(
        cacheKey,
        cacheTimeKey,
        _roundStatsCacheDurationMinutes,
        (json) => RoundStatisticsModel.fromJson(
            jsonDecode(json) as Map<String, dynamic>),
        ignoreExpiry: true,
      );
      if (cachedData != null) {
        return cachedData;
      }

      throw NetworkFailure(
          'Failed to fetch round statistics: ${e.toString()}');
    }
  }

  /// Generic cache getter
  Future<T?> _getCachedData<T>(
    String cacheKey,
    String cacheTimeKey,
    int cacheDurationMinutes,
    T Function(String) decoder, {
    bool ignoreExpiry = false,
  }) async {
    try {
      final cachedJson = _prefs.getString(cacheKey);
      final cacheTime = _prefs.getInt(cacheTimeKey);

      if (cachedJson == null || cacheTime == null) {
        return null;
      }

      // Check if cache is still fresh
      if (!ignoreExpiry) {
        final cacheAge = DateTime.now().millisecondsSinceEpoch - cacheTime;
        final cacheExpired = cacheAge > (cacheDurationMinutes * 60 * 1000);

        if (cacheExpired) {
          return null;
        }
      }

      return decoder(cachedJson);
    } catch (e) {
      // If cache is corrupted, clear it
      await _clearCache(cacheKey, cacheTimeKey);
      return null;
    }
  }

  /// Generic cache setter
  Future<void> _cacheData(
    String cacheKey,
    String cacheTimeKey,
    dynamic data,
  ) async {
    try {
      String encoded;
      if (data is List) {
        encoded = jsonEncode(data.map((e) => e.toJson()).toList());
      } else {
        encoded = jsonEncode(data.toJson());
      }
      await _prefs.setString(cacheKey, encoded);
      await _prefs.setInt(cacheTimeKey, DateTime.now().millisecondsSinceEpoch);
    } catch (e) {
      // Silently fail - caching is optional
    }
  }

  /// Clear specific cache
  Future<void> _clearCache(String cacheKey, String cacheTimeKey) async {
    await _prefs.remove(cacheKey);
    await _prefs.remove(cacheTimeKey);
  }

  /// Get unpicked players for a specific round
  /// Returns list of players who haven't made their pick yet
  Future<List<UnpickedPlayerModel>> getUnpickedPlayers({
    required int competitionId,
    int? roundId,
  }) async {
    try {
      final response = await _apiClient.post(
        '/get-unpicked-players',
        data: {
          'competition_id': competitionId,
          if (roundId != null) 'round_id': roundId,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final returnCode = data['return_code'] as String;

      if (returnCode == AppConstants.successCode) {
        final unpickedPlayers = (data['unpicked_players'] as List? ?? [])
            .map((e) => UnpickedPlayerModel.fromJson(e as Map<String, dynamic>))
            .toList();

        return unpickedPlayers;
      } else {
        final message =
            data['message'] as String? ?? 'Failed to fetch unpicked players';
        throw ServerFailure(message);
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw NetworkFailure('Failed to fetch unpicked players: ${e.toString()}');
    }
  }

  /// Clear all competition caches for a specific competition
  Future<void> clearCompetitionCache(int competitionId) async {
    final keys = _prefs.getKeys();
    for (final key in keys) {
      if (key.contains('competition_') && key.contains('_$competitionId')) {
        await _prefs.remove(key);
      }
    }
  }
}
