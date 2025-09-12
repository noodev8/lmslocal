// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'competition.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Competition _$CompetitionFromJson(Map<String, dynamic> json) => Competition(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  description: json['description'] as String?,
  status: json['status'] as String,
  livesPerPlayer: (json['lives_per_player'] as num).toInt(),
  noTeamTwice: json['no_team_twice'] as bool,
  inviteCode: json['invite_code'] as String,
  slug: json['slug'] as String?,
  teamListId: (json['team_list_id'] as num).toInt(),
  teamListName: json['team_list_name'] as String,
  playerCount: (json['player_count'] as num).toInt(),
  createdAt: json['created_at'] as String,
  currentRound: (json['current_round'] as num?)?.toInt(),
  isOrganiser: json['is_organiser'] as bool,
  userStatus: json['user_status'] as String?,
);

Map<String, dynamic> _$CompetitionToJson(Competition instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'description': instance.description,
      'status': instance.status,
      'lives_per_player': instance.livesPerPlayer,
      'no_team_twice': instance.noTeamTwice,
      'invite_code': instance.inviteCode,
      'slug': instance.slug,
      'team_list_id': instance.teamListId,
      'team_list_name': instance.teamListName,
      'player_count': instance.playerCount,
      'created_at': instance.createdAt,
      'current_round': instance.currentRound,
      'is_organiser': instance.isOrganiser,
      'user_status': instance.userStatus,
    };

CompetitionsResponse _$CompetitionsResponseFromJson(
  Map<String, dynamic> json,
) => CompetitionsResponse(
  returnCode: json['return_code'] as String,
  competitions: (json['competitions'] as List<dynamic>)
      .map((e) => Competition.fromJson(e as Map<String, dynamic>))
      .toList(),
  message: json['message'] as String?,
);

Map<String, dynamic> _$CompetitionsResponseToJson(
  CompetitionsResponse instance,
) => <String, dynamic>{
  'return_code': instance.returnCode,
  'competitions': instance.competitions,
  'message': instance.message,
};
