import 'package:equatable/equatable.dart';

/// Round information entity
class RoundInfo extends Equatable {
  final int id;
  final int roundNumber;
  final DateTime lockTime;
  final int fixtureCount;
  final int? completedFixtures;
  final String? status;
  final int? activePlayers;

  const RoundInfo({
    required this.id,
    required this.roundNumber,
    required this.lockTime,
    required this.fixtureCount,
    this.completedFixtures,
    this.status,
    this.activePlayers,
  });

  /// Check if round is locked (past lock time)
  bool get isLocked => DateTime.now().isAfter(lockTime);

  @override
  List<Object?> get props => [
        id,
        roundNumber,
        lockTime,
        fixtureCount,
        completedFixtures,
        status,
        activePlayers,
      ];
}
