import 'package:equatable/equatable.dart';

/// Allowed team entity - teams the player can still pick
class AllowedTeam extends Equatable {
  final String shortName;
  final String fullName;

  const AllowedTeam({
    required this.shortName,
    required this.fullName,
  });

  @override
  List<Object?> get props => [shortName, fullName];
}
