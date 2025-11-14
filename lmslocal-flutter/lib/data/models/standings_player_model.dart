import 'package:lmslocal_flutter/domain/entities/standings_player.dart';

/// Current pick model for JSON serialization
class CurrentPickModel extends CurrentPick {
  const CurrentPickModel({
    required super.team,
    required super.teamFullName,
    required super.fixture,
    required super.outcome,
  });

  factory CurrentPickModel.fromJson(Map<String, dynamic> json) {
    return CurrentPickModel(
      team: json['team'] as String? ?? '',
      teamFullName: json['team_full_name'] as String? ?? '',
      fixture: json['fixture'] as String? ?? '',
      outcome: json['outcome'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'team': team,
      'team_full_name': teamFullName,
      'fixture': fixture,
      'outcome': outcome,
    };
  }
}

/// Elimination pick model for JSON serialization
class EliminationPickModel extends EliminationPick {
  const EliminationPickModel({
    required super.roundNumber,
    required super.team,
    required super.fixture,
    required super.result,
  });

  factory EliminationPickModel.fromJson(Map<String, dynamic> json) {
    return EliminationPickModel(
      roundNumber: json['round_number'] as int? ?? 0,
      team: json['team'] as String? ?? '',
      fixture: json['fixture'] as String? ?? '',
      result: json['result'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'round_number': roundNumber,
      'team': team,
      'fixture': fixture,
      'result': result,
    };
  }
}

/// Standings player model for JSON serialization
class StandingsPlayerModel extends StandingsPlayer {
  const StandingsPlayerModel({
    required super.id,
    required super.displayName,
    required super.livesRemaining,
    required super.status,
    super.groupName,
    super.currentPick,
    super.eliminationPick,
  });

  factory StandingsPlayerModel.fromJson(Map<String, dynamic> json) {
    return StandingsPlayerModel(
      id: json['id'] as int,
      displayName: json['display_name'] as String,
      livesRemaining: json['lives_remaining'] as int,
      status: json['status'] as String,
      groupName: json['group_name'] as String?,
      currentPick: json['current_pick'] != null
          ? CurrentPickModel.fromJson(json['current_pick'] as Map<String, dynamic>)
          : null,
      eliminationPick: json['elimination_pick'] != null
          ? EliminationPickModel.fromJson(json['elimination_pick'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'display_name': displayName,
      'lives_remaining': livesRemaining,
      'status': status,
      'group_name': groupName,
      'current_pick': currentPick != null
          ? (currentPick as CurrentPickModel).toJson()
          : null,
      'elimination_pick': eliminationPick != null
          ? (eliminationPick as EliminationPickModel).toJson()
          : null,
    };
  }
}
