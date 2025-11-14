import 'package:lmslocal_flutter/domain/entities/round_statistics.dart';

/// Round statistics model for JSON serialization
class RoundStatisticsModel extends RoundStatistics {
  const RoundStatisticsModel({
    required super.roundNumber,
    required super.totalPlayers,
    required super.won,
    required super.lost,
    required super.eliminated,
  });

  factory RoundStatisticsModel.fromJson(Map<String, dynamic> json) {
    return RoundStatisticsModel(
      roundNumber: json['round_number'] as int,
      totalPlayers: json['total_players'] as int,
      won: json['won'] as int,
      lost: json['lost'] as int,
      eliminated: json['eliminated'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'round_number': roundNumber,
      'total_players': totalPlayers,
      'won': won,
      'lost': lost,
      'eliminated': eliminated,
    };
  }
}
