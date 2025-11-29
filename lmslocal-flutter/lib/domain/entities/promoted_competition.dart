import 'package:equatable/equatable.dart';

/// Promoted competition entity for competitions available to join
/// Displayed in the "Featured Competitions" section on dashboard
class PromotedCompetition extends Equatable {
  final int id;
  final String name;
  final String? description;
  final String? venueName;
  final String? city;
  final String? prizeStructure;
  final String? entryFee;
  final String? logoUrl;
  final String inviteCode;
  final int playerCount;
  final DateTime lockTime;

  const PromotedCompetition({
    required this.id,
    required this.name,
    this.description,
    this.venueName,
    this.city,
    this.prizeStructure,
    this.entryFee,
    this.logoUrl,
    required this.inviteCode,
    required this.playerCount,
    required this.lockTime,
  });

  @override
  List<Object?> get props => [
        id,
        name,
        description,
        venueName,
        city,
        prizeStructure,
        entryFee,
        logoUrl,
        inviteCode,
        playerCount,
        lockTime,
      ];
}
