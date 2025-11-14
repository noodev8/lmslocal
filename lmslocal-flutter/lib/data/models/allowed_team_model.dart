import 'package:lmslocal_flutter/domain/entities/allowed_team.dart';

/// Allowed team model for JSON serialization
class AllowedTeamModel extends AllowedTeam {
  const AllowedTeamModel({
    required super.shortName,
    required super.fullName,
  });

  factory AllowedTeamModel.fromJson(Map<String, dynamic> json) {
    return AllowedTeamModel(
      shortName: json['short_name'] as String,
      fullName: json['name'] as String,  // API returns 'name', not 'full_name'
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'short_name': shortName,
      'full_name': fullName,
    };
  }
}
