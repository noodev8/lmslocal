import 'package:lmslocal_flutter/domain/entities/competition.dart';

/// Competition model for JSON serialization
class CompetitionModel extends Competition {
  const CompetitionModel({
    required super.id,
    required super.name,
    super.description,
    super.logoUrl,
    required super.status,
    required super.livesPerPlayer,
    required super.noTeamTwice,
    super.inviteCode,
    super.slug,
    super.teamListId,
    super.teamListName,
    required super.createdAt,
    required super.playerCount,
    required super.currentRound,
    required super.totalRounds,
    required super.isComplete,
    required super.isOrganiser,
    required super.isParticipant,
    super.userStatus,
    super.livesRemaining,
    super.joinedAt,
    super.playerDisplayName,
    super.manageResults,
    super.manageFixtures,
    super.managePlayers,
    super.needsPick,
    super.currentPick,
    super.history,
    super.winnerName,
  });

  factory CompetitionModel.fromJson(Map<String, dynamic> json) {
    return CompetitionModel(
      id: json['id'] as int,
      name: json['name'] as String,
      description: json['description'] as String?,
      logoUrl: json['logo_url'] as String?,
      status: json['status'] as String,
      livesPerPlayer: json['lives_per_player'] as int,
      noTeamTwice: json['no_team_twice'] as bool,
      inviteCode: json['invite_code'] as String?,
      slug: json['slug'] as String?,
      teamListId: json['team_list_id'] as int?,
      teamListName: json['team_list_name'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      playerCount: json['player_count'] as int,
      currentRound: json['current_round'] as int,
      totalRounds: json['total_rounds'] as int,
      isComplete: json['is_complete'] as bool,
      isOrganiser: json['is_organiser'] as bool,
      isParticipant: json['is_participant'] as bool,
      userStatus: json['user_status'] as String?,
      livesRemaining: json['lives_remaining'] as int?,
      joinedAt: json['joined_at'] != null
          ? DateTime.parse(json['joined_at'] as String)
          : null,
      playerDisplayName: json['player_display_name'] as String?,
      manageResults: json['manage_results'] as bool?,
      manageFixtures: json['manage_fixtures'] as bool?,
      managePlayers: json['manage_players'] as bool?,
      needsPick: json['needs_pick'] as bool?,
      currentPick: json['current_pick'] != null
          ? CurrentPickModel.fromJson(json['current_pick'] as Map<String, dynamic>)
          : null,
      history: json['history'] != null
          ? (json['history'] as List)
              .map((e) => PickHistoryModel.fromJson(e as Map<String, dynamic>))
              .toList()
          : [],
      winnerName: json['winner_name'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'logo_url': logoUrl,
      'status': status,
      'lives_per_player': livesPerPlayer,
      'no_team_twice': noTeamTwice,
      'invite_code': inviteCode,
      'slug': slug,
      'team_list_id': teamListId,
      'team_list_name': teamListName,
      'created_at': createdAt.toIso8601String(),
      'player_count': playerCount,
      'current_round': currentRound,
      'total_rounds': totalRounds,
      'is_complete': isComplete,
      'is_organiser': isOrganiser,
      'is_participant': isParticipant,
      'user_status': userStatus,
      'lives_remaining': livesRemaining,
      'joined_at': joinedAt?.toIso8601String(),
      'player_display_name': playerDisplayName,
      'manage_results': manageResults,
      'manage_fixtures': manageFixtures,
      'manage_players': managePlayers,
      'needs_pick': needsPick,
      'current_pick': currentPick != null
          ? (currentPick as CurrentPickModel).toJson()
          : null,
      'history': history.map((e) => (e as PickHistoryModel).toJson()).toList(),
      'winner_name': winnerName,
    };
  }
}

/// Current pick model
class CurrentPickModel extends CurrentPick {
  const CurrentPickModel({
    required super.team,
    required super.teamFullName,
    required super.fixture,
  });

  factory CurrentPickModel.fromJson(Map<String, dynamic> json) {
    return CurrentPickModel(
      team: json['team'] as String,
      teamFullName: json['team_full_name'] as String,
      fixture: json['fixture'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'team': team,
      'team_full_name': teamFullName,
      'fixture': fixture,
    };
  }
}

/// Pick history model
class PickHistoryModel extends PickHistory {
  const PickHistoryModel({
    required super.roundNumber,
    super.pickTeam,
    super.pickTeamFullName,
    super.fixture,
    required super.pickResult,
    required super.lockTime,
  });

  factory PickHistoryModel.fromJson(Map<String, dynamic> json) {
    return PickHistoryModel(
      roundNumber: json['round_number'] as int,
      pickTeam: json['pick_team'] as String?,
      pickTeamFullName: json['pick_team_full_name'] as String?,
      fixture: json['fixture'] as String?,
      pickResult: json['pick_result'] as String,
      lockTime: DateTime.parse(json['lock_time'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'round_number': roundNumber,
      'pick_team': pickTeam,
      'pick_team_full_name': pickTeamFullName,
      'fixture': fixture,
      'pick_result': pickResult,
      'lock_time': lockTime.toIso8601String(),
    };
  }
}
