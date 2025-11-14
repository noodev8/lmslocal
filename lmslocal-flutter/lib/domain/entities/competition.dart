import 'package:equatable/equatable.dart';

/// Competition entity representing user's competition data
class Competition extends Equatable {
  final int id;
  final String name;
  final String? description;
  final String? logoUrl;
  final String status;
  final int livesPerPlayer;
  final bool noTeamTwice;
  final String? inviteCode;
  final String? slug;
  final int? teamListId;
  final String? teamListName;
  final DateTime createdAt;
  final int playerCount;
  final int currentRound;
  final int totalRounds;
  final bool isComplete;
  final bool isOrganiser;
  final bool isParticipant;
  final String? userStatus;
  final int? livesRemaining;
  final DateTime? joinedAt;
  final bool? manageResults;
  final bool? manageFixtures;
  final bool? managePlayers;
  final bool? needsPick;
  final CurrentPick? currentPick;
  final List<PickHistory> history;
  final String? winnerName;

  const Competition({
    required this.id,
    required this.name,
    this.description,
    this.logoUrl,
    required this.status,
    required this.livesPerPlayer,
    required this.noTeamTwice,
    this.inviteCode,
    this.slug,
    this.teamListId,
    this.teamListName,
    required this.createdAt,
    required this.playerCount,
    required this.currentRound,
    required this.totalRounds,
    required this.isComplete,
    required this.isOrganiser,
    required this.isParticipant,
    this.userStatus,
    this.livesRemaining,
    this.joinedAt,
    this.manageResults,
    this.manageFixtures,
    this.managePlayers,
    this.needsPick,
    this.currentPick,
    this.history = const [],
    this.winnerName,
  });

  @override
  List<Object?> get props => [
        id,
        name,
        description,
        logoUrl,
        status,
        livesPerPlayer,
        noTeamTwice,
        inviteCode,
        slug,
        teamListId,
        teamListName,
        createdAt,
        playerCount,
        currentRound,
        totalRounds,
        isComplete,
        isOrganiser,
        isParticipant,
        userStatus,
        livesRemaining,
        joinedAt,
        manageResults,
        manageFixtures,
        managePlayers,
        needsPick,
        currentPick,
        history,
        winnerName,
      ];
}

/// Current pick for active round
class CurrentPick extends Equatable {
  final String team;
  final String teamFullName;
  final String fixture;

  const CurrentPick({
    required this.team,
    required this.teamFullName,
    required this.fixture,
  });

  @override
  List<Object?> get props => [team, teamFullName, fixture];
}

/// Pick history for previous rounds
class PickHistory extends Equatable {
  final int roundNumber;
  final String? pickTeam;
  final String? pickTeamFullName;
  final String? fixture;
  final String pickResult;
  final DateTime lockTime;

  const PickHistory({
    required this.roundNumber,
    this.pickTeam,
    this.pickTeamFullName,
    this.fixture,
    required this.pickResult,
    required this.lockTime,
  });

  @override
  List<Object?> get props => [
        roundNumber,
        pickTeam,
        pickTeamFullName,
        fixture,
        pickResult,
        lockTime,
      ];
}
