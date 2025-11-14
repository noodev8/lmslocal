import 'package:equatable/equatable.dart';

/// Round history entity for player pick timeline
class RoundHistory extends Equatable {
  final int roundId;
  final int roundNumber;
  final String pickTeam;
  final String pickTeamFullName;
  final String? fixture;
  final String? fixtureResult;
  final String pickResult;
  final String lockTime;

  const RoundHistory({
    required this.roundId,
    required this.roundNumber,
    required this.pickTeam,
    required this.pickTeamFullName,
    this.fixture,
    this.fixtureResult,
    required this.pickResult,
    required this.lockTime,
  });

  @override
  List<Object?> get props => [
        roundId,
        roundNumber,
        pickTeam,
        pickTeamFullName,
        fixture,
        fixtureResult,
        pickResult,
        lockTime,
      ];
}
