import 'package:equatable/equatable.dart';

/// Round statistics showing outcomes
class RoundStatistics extends Equatable {
  final int roundNumber;
  final int totalPlayers;
  final int won;
  final int lost;
  final int eliminated;

  const RoundStatistics({
    required this.roundNumber,
    required this.totalPlayers,
    required this.won,
    required this.lost,
    required this.eliminated,
  });

  /// Calculate percentage for a segment
  double getPercentage(int value) {
    if (totalPlayers == 0) return 0.0;
    return (value / totalPlayers) * 100;
  }

  @override
  List<Object?> get props => [
        roundNumber,
        totalPlayers,
        won,
        lost,
        eliminated,
      ];
}
