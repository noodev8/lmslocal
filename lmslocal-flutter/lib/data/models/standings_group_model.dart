import 'package:lmslocal_flutter/domain/entities/standings_group.dart';

/// Standings group model for JSON serialization
class StandingsGroupModel extends StandingsGroup {
  const StandingsGroupModel({
    required super.key,
    required super.name,
    required super.lives,
    required super.fixtureStatus,
    required super.count,
    required super.icon,
    super.winnerName,
  });

  factory StandingsGroupModel.fromJson(Map<String, dynamic> json) {
    return StandingsGroupModel(
      key: json['key'] as String,
      name: json['name'] as String,
      lives: json['lives'] as int?,
      fixtureStatus: json['fixture_status'] as String?,
      count: json['count'] as int,
      icon: json['icon'] as String,
      winnerName: json['winner_name'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'key': key,
      'name': name,
      'lives': lives,
      'fixture_status': fixtureStatus,
      'count': count,
      'icon': icon,
      'winner_name': winnerName,
    };
  }
}
