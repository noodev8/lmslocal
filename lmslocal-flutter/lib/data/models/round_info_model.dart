import 'package:lmslocal_flutter/domain/entities/round_info.dart';

/// Round info model for JSON serialization
class RoundInfoModel extends RoundInfo {
  const RoundInfoModel({
    required super.id,
    required super.roundNumber,
    required super.lockTime,
    required super.fixtureCount,
    super.completedFixtures,
    super.status,
    super.activePlayers,
  });

  factory RoundInfoModel.fromJson(Map<String, dynamic> json) {
    return RoundInfoModel(
      id: json['id'] as int,
      roundNumber: json['round_number'] as int,
      lockTime: DateTime.parse(json['lock_time'] as String),
      fixtureCount: json['fixture_count'] as int,
      completedFixtures: json['completed_fixtures'] as int?,
      status: json['status'] as String?,
      activePlayers: json['active_players'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'round_number': roundNumber,
      'lock_time': lockTime.toIso8601String(),
      'fixture_count': fixtureCount,
      'completed_fixtures': completedFixtures,
      'status': status,
      'active_players': activePlayers,
    };
  }
}
