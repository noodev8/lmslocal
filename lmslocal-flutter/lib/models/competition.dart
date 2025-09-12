import 'package:json_annotation/json_annotation.dart';

part 'competition.g.dart';

@JsonSerializable()
class Competition {
  final int id;
  final String name;
  final String? description;
  final String status;
  @JsonKey(name: 'lives_per_player')
  final int livesPerPlayer;
  @JsonKey(name: 'no_team_twice')
  final bool noTeamTwice;
  @JsonKey(name: 'invite_code')
  final String inviteCode;
  final String? slug;
  @JsonKey(name: 'team_list_id')
  final int teamListId;
  @JsonKey(name: 'team_list_name')
  final String teamListName;
  @JsonKey(name: 'player_count')
  final int playerCount;
  @JsonKey(name: 'created_at')
  final String createdAt;
  @JsonKey(name: 'current_round')
  final int? currentRound;
  @JsonKey(name: 'is_organiser')
  final bool isOrganiser;
  @JsonKey(name: 'user_status')
  final String? userStatus;

  const Competition({
    required this.id,
    required this.name,
    this.description,
    required this.status,
    required this.livesPerPlayer,
    required this.noTeamTwice,
    required this.inviteCode,
    this.slug,
    required this.teamListId,
    required this.teamListName,
    required this.playerCount,
    required this.createdAt,
    this.currentRound,
    required this.isOrganiser,
    this.userStatus,
  });

  factory Competition.fromJson(Map<String, dynamic> json) => _$CompetitionFromJson(json);
  Map<String, dynamic> toJson() => _$CompetitionToJson(this);

  // Helper getters
  bool get hasStarted => currentRound != null && currentRound! > 0;
  bool get isActive => status != 'COMPLETE';
  String get statusDisplayText {
    switch (status) {
      case 'OPEN':
        return 'Open for players';
      case 'LOCKED':
        return 'Players locked';
      case 'ACTIVE':
        return 'In progress';
      case 'COMPLETE':
        return 'Finished';
      default:
        return status.toLowerCase().replaceAll('_', ' ');
    }
  }
  
  String get userStatusDisplayText {
    if (userStatus == 'OUT') {
      return 'OUT';
    } else {
      return 'Active';
    }
  }
}

@JsonSerializable()
class CompetitionsResponse {
  @JsonKey(name: 'return_code')
  final String returnCode;
  final List<Competition> competitions;
  final String? message;

  const CompetitionsResponse({
    required this.returnCode,
    required this.competitions,
    this.message,
  });

  factory CompetitionsResponse.fromJson(Map<String, dynamic> json) => _$CompetitionsResponseFromJson(json);
  Map<String, dynamic> toJson() => _$CompetitionsResponseToJson(this);

  bool get isSuccess => returnCode == 'SUCCESS';
}