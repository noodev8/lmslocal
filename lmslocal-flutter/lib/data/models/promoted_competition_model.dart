import 'package:lmslocal_flutter/domain/entities/promoted_competition.dart';

/// Promoted competition model for JSON serialization
class PromotedCompetitionModel extends PromotedCompetition {
  const PromotedCompetitionModel({
    required super.id,
    required super.name,
    super.venueName,
    super.city,
    super.prizeStructure,
    super.entryFee,
    super.logoUrl,
    required super.inviteCode,
    required super.playerCount,
    required super.lockTime,
  });

  factory PromotedCompetitionModel.fromJson(Map<String, dynamic> json) {
    return PromotedCompetitionModel(
      id: json['id'] as int,
      name: json['name'] as String,
      venueName: json['venue_name'] as String?,
      city: json['city'] as String?,
      prizeStructure: json['prize_structure'] as String?,
      entryFee: json['entry_fee']?.toString(),
      logoUrl: json['logo_url'] as String?,
      inviteCode: json['invite_code'] as String,
      playerCount: json['player_count'] as int? ?? 0,
      lockTime: DateTime.parse(json['lock_time'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'venue_name': venueName,
      'city': city,
      'prize_structure': prizeStructure,
      'entry_fee': entryFee,
      'logo_url': logoUrl,
      'invite_code': inviteCode,
      'player_count': playerCount,
      'lock_time': lockTime.toIso8601String(),
    };
  }
}
