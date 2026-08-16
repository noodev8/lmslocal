import 'package:equatable/equatable.dart';

/// Competition entity representing user's competition data
class Competition extends Equatable {
  final int id;
  final String name;
  final String? description;
  final String? prizeStructure;

  /// What a player pays to enter, if anything. Read only by the invitation —
  /// it is part of what someone needs to know before they join.
  final double? entryFee;
  final String? venueName;
  final String? city;
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

  /// The current round's lock time, and the three fixture counts beside it.
  ///
  /// Only ever read together, by the round state machine in
  /// `core/game/round_state.dart` — they are what lets the dashboard reach
  /// every phase without fetching a round's fixture rows. Null before any round
  /// exists.
  final DateTime? currentRoundLockTime;
  final int totalFixtures;
  final int fixturesWithResults;
  final int fixturesProcessed;

  final int totalRounds;
  final bool isComplete;
  final bool isOrganiser;
  final bool isParticipant;
  final String? userStatus;
  final int? livesRemaining;
  final DateTime? joinedAt;
  final String? playerDisplayName;
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
    this.prizeStructure,
    this.entryFee,
    this.venueName,
    this.city,
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
    this.currentRoundLockTime,
    this.totalFixtures = 0,
    this.fixturesWithResults = 0,
    this.fixturesProcessed = 0,
    required this.totalRounds,
    required this.isComplete,
    required this.isOrganiser,
    required this.isParticipant,
    this.userStatus,
    this.livesRemaining,
    this.joinedAt,
    this.playerDisplayName,
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
        prizeStructure,
        entryFee,
        venueName,
        city,
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
        currentRoundLockTime,
        totalFixtures,
        fixturesWithResults,
        fixturesProcessed,
        totalRounds,
        isComplete,
        isOrganiser,
        isParticipant,
        userStatus,
        livesRemaining,
        joinedAt,
        playerDisplayName,
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
