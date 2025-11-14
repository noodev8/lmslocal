import 'package:equatable/equatable.dart';

/// Standings group entity - represents a group of players with similar status
class StandingsGroup extends Equatable {
  final String key;
  final String name;
  final int? lives;
  final String? fixtureStatus;
  final int count;
  final String icon;
  final String? winnerName;

  const StandingsGroup({
    required this.key,
    required this.name,
    required this.lives,
    required this.fixtureStatus,
    required this.count,
    required this.icon,
    this.winnerName,
  });

  @override
  List<Object?> get props => [
        key,
        name,
        lives,
        fixtureStatus,
        count,
        icon,
        winnerName,
      ];
}
