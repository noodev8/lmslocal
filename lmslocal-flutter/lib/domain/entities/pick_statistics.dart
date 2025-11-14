import 'package:equatable/equatable.dart';

/// Pick statistics for a round
class PickStatistics extends Equatable {
  final int playersWithPicks;
  final int totalActivePlayers;
  final double pickPercentage;

  const PickStatistics({
    required this.playersWithPicks,
    required this.totalActivePlayers,
    required this.pickPercentage,
  });

  @override
  List<Object?> get props => [
        playersWithPicks,
        totalActivePlayers,
        pickPercentage,
      ];
}
