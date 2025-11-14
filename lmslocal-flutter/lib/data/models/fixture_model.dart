import 'package:lmslocal_flutter/domain/entities/fixture.dart';

/// Fixture model for JSON serialization
class FixtureModel extends Fixture {
  const FixtureModel({
    required super.id,
    required super.homeTeam,
    required super.awayTeam,
    required super.homeTeamShort,
    required super.awayTeamShort,
    required super.kickoffTime,
    super.result,
  });

  factory FixtureModel.fromJson(Map<String, dynamic> json) {
    return FixtureModel(
      id: json['id'] as int,
      homeTeam: (json['home_team'] as String?) ?? '',
      awayTeam: (json['away_team'] as String?) ?? '',
      homeTeamShort: (json['home_team_short'] as String?) ?? '',
      awayTeamShort: (json['away_team_short'] as String?) ?? '',
      kickoffTime: json['kickoff_time'] != null
          ? DateTime.parse(json['kickoff_time'] as String)
          : DateTime.now(),
      result: json['result'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'home_team': homeTeam,
      'away_team': awayTeam,
      'home_team_short': homeTeamShort,
      'away_team_short': awayTeamShort,
      'kickoff_time': kickoffTime.toIso8601String(),
      'result': result,
    };
  }
}
