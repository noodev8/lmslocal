import 'package:equatable/equatable.dart';

/// Fixture entity representing a match between two teams
class Fixture extends Equatable {
  final int id;
  final String homeTeam;
  final String awayTeam;
  final String homeTeamShort;
  final String awayTeamShort;
  final DateTime kickoffTime;
  final String? result;

  const Fixture({
    required this.id,
    required this.homeTeam,
    required this.awayTeam,
    required this.homeTeamShort,
    required this.awayTeamShort,
    required this.kickoffTime,
    this.result,
  });

  @override
  List<Object?> get props => [
        id,
        homeTeam,
        awayTeam,
        homeTeamShort,
        awayTeamShort,
        kickoffTime,
        result,
      ];
}
