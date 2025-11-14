import 'package:lmslocal_flutter/domain/entities/round_history.dart';

/// Round history model for JSON serialization
class RoundHistoryModel extends RoundHistory {
  const RoundHistoryModel({
    required super.roundId,
    required super.roundNumber,
    required super.pickTeam,
    required super.pickTeamFullName,
    super.fixture,
    super.fixtureResult,
    required super.pickResult,
    required super.lockTime,
  });

  factory RoundHistoryModel.fromJson(Map<String, dynamic> json) {
    return RoundHistoryModel(
      roundId: json['round_id'] as int,
      roundNumber: json['round_number'] as int,
      pickTeam: json['pick_team'] as String? ?? '',
      pickTeamFullName: json['pick_team_full_name'] as String? ?? '',
      fixture: json['fixture'] as String?,
      fixtureResult: json['fixture_result'] as String?,
      pickResult: json['pick_result'] as String? ?? 'pending',
      lockTime: json['lock_time'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'round_id': roundId,
      'round_number': roundNumber,
      'pick_team': pickTeam,
      'pick_team_full_name': pickTeamFullName,
      'fixture': fixture,
      'fixture_result': fixtureResult,
      'pick_result': pickResult,
      'lock_time': lockTime,
    };
  }
}
