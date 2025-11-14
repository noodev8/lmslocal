import 'package:lmslocal_flutter/domain/entities/unpicked_player.dart';

/// Unpicked player model for JSON serialization
class UnpickedPlayerModel extends UnpickedPlayer {
  const UnpickedPlayerModel({
    required super.userId,
    required super.displayName,
  });

  factory UnpickedPlayerModel.fromJson(Map<String, dynamic> json) {
    return UnpickedPlayerModel(
      userId: json['user_id'] as int,
      displayName: json['display_name'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'display_name': displayName,
    };
  }
}
