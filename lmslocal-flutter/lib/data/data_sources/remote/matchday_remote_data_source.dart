import 'package:lmslocal_flutter/core/constants/app_constants.dart';
import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/domain/entities/matchday.dart';

/// Matchday's routes (docs/matchday-app.md §4). The header block at the top of
/// each route file on the server is the exact contract.
///
/// **Never cached**, unlike the LMS data sources: a coupon changes with every
/// card a player answers and the table with every results push, and a stale
/// "predicted" is the one thing this screen must never show. Saves are never
/// queued for later either - a prediction is confirmed by the server or it did
/// not happen, because a lock can pass in between (§15).
class MatchdayRemoteDataSource {
  final ApiClient _apiClient;

  MatchdayRemoteDataSource({required this._apiClient});

  /// Posts to [path] and returns the body on SUCCESS. Anything else is a
  /// [ServerFailure] carrying the return code, so a caller can tell
  /// `ROUND_LOCKED` from a dropped connection.
  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
    String fallbackMessage,
  ) async {
    final Map<String, dynamic> data;
    try {
      final response = await _apiClient.post(path, data: body);
      data = response.data as Map<String, dynamic>;
    } catch (e) {
      throw NetworkFailure('$fallbackMessage Check your connection and try again.');
    }
    final code = data['return_code'] as String?;
    if (code != AppConstants.successCode) {
      throw ServerFailure(
        data['message'] as String? ?? fallbackMessage,
        code: code,
      );
    }
    return data;
  }

  /// A player's coupon for a round; the latest when [roundNumber] is null.
  Future<MatchdayCoupon> getPredictions(int competitionId, {int? roundNumber}) async {
    final data = await _post(
      '/get-predictions',
      {
        'competition_id': competitionId,
        'round_number': ?roundNumber,
      },
      'These predictions could not be loaded.',
    );
    return MatchdayCoupon.fromJson(data);
  }

  /// Predict the winner of one match, or change the prediction.
  Future<void> setPrediction(int fixtureId, String team) => _post(
        '/set-prediction',
        {'fixture_id': fixtureId, 'team': team},
        'That did not save.',
      );

  /// Take a prediction back - the match then scores 0. Safe to repeat.
  Future<void> clearPrediction(int fixtureId) => _post(
        '/clear-prediction',
        {'fixture_id': fixtureId},
        'That did not save.',
      );

  Future<MatchdayTable> getTable(int competitionId) async {
    final data = await _post(
      '/get-matchday-table',
      {'competition_id': competitionId},
      'The table could not be loaded.',
    );
    return MatchdayTable.fromJson(data);
  }

  /// Everyone's predictions for a LOCKED round; the latest locked one when
  /// [roundNumber] is null. The server refuses an open round with FORBIDDEN -
  /// nobody sees anyone else's predictions before the lock.
  Future<MatchdayRoundPredictions> getRoundPredictions(
    int competitionId, {
    int? roundNumber,
  }) async {
    final data = await _post(
      '/get-round-predictions',
      {
        'competition_id': competitionId,
        'round_number': ?roundNumber,
      },
      'These predictions could not be loaded.',
    );
    return MatchdayRoundPredictions.fromJson(data);
  }
}
