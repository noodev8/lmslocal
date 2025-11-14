import 'package:lmslocal_flutter/domain/entities/user.dart';

/// User model for data layer
/// Handles JSON serialization/deserialization
class UserModel extends User {
  const UserModel({
    required super.id,
    required super.email,
    required super.displayName,
    required super.emailVerified,
    super.lastLogin,
  });

  /// Create UserModel from JSON (API response)
  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as int,
      email: json['email'] as String,
      displayName: json['display_name'] as String,
      emailVerified: json['email_verified'] as bool? ?? true,
      lastLogin: json['last_login'] != null
          ? DateTime.parse(json['last_login'] as String)
          : null,
    );
  }

  /// Convert UserModel to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'display_name': displayName,
      'email_verified': emailVerified,
      'last_login': lastLogin?.toIso8601String(),
    };
  }

  /// Convert UserModel to User entity
  User toEntity() {
    return User(
      id: id,
      email: email,
      displayName: displayName,
      emailVerified: emailVerified,
      lastLogin: lastLogin,
    );
  }
}
