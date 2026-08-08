import 'package:equatable/equatable.dart';

/// Current pick entity for standings
class CurrentPick extends Equatable {
  final String team;
  final String teamFullName;
  final String fixture;
  final String outcome;

  const CurrentPick({
    required this.team,
    required this.teamFullName,
    required this.fixture,
    required this.outcome,
  });

  @override
  List<Object?> get props => [team, teamFullName, fixture, outcome];
}

/// Elimination pick entity for standings
class EliminationPick extends Equatable {
  final int roundNumber;
  final String team;
  final String fixture;
  final String result;

  const EliminationPick({
    required this.roundNumber,
    required this.team,
    required this.fixture,
    required this.result,
  });

  @override
  List<Object?> get props => [roundNumber, team, fixture, result];
}

/// Standings player entity
class StandingsPlayer extends Equatable {
  final int id;
  final String displayName;
  final int livesRemaining;
  final String status;
  final String? groupName;
  final CurrentPick? currentPick;
  final EliminationPick? eliminationPick;

  /// One of our placeholder players. Derived server-side from the bot email
  /// pattern (`services/botPool.js`), never guessed from the name — the "Bot "
  /// prefix is stripped from a competition's own display names, so the name is
  /// not evidence either way. Defaults false so a route that does not return the
  /// flag cannot label a real person a bot.
  final bool isBot;

  const StandingsPlayer({
    required this.id,
    required this.displayName,
    required this.livesRemaining,
    required this.status,
    this.groupName,
    this.currentPick,
    this.eliminationPick,
    this.isBot = false,
  });

  @override
  List<Object?> get props => [
        id,
        displayName,
        livesRemaining,
        status,
        groupName,
        currentPick,
        eliminationPick,
        isBot,
      ];
}
