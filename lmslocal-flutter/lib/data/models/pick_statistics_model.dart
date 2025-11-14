import 'package:lmslocal_flutter/domain/entities/pick_statistics.dart';

/// Pick statistics model for JSON serialization
class PickStatisticsModel extends PickStatistics {
  const PickStatisticsModel({
    required super.playersWithPicks,
    required super.totalActivePlayers,
    required super.pickPercentage,
  });

  factory PickStatisticsModel.fromJson(Map<String, dynamic> json) {
    return PickStatisticsModel(
      playersWithPicks: json['players_with_picks'] as int,
      totalActivePlayers: json['total_active_players'] as int,
      pickPercentage: (json['pick_percentage'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'players_with_picks': playersWithPicks,
      'total_active_players': totalActivePlayers,
      'pick_percentage': pickPercentage,
    };
  }
}
