import 'package:lmslocal_flutter/data/models/user_model.dart';
import 'package:lmslocal_flutter/domain/entities/auth_result.dart';

/// AuthResult model for data layer
/// Handles JSON serialization/deserialization for login/register responses
class AuthResultModel extends AuthResult {
  const AuthResultModel({
    required super.user,
    required super.token,
    required super.expiresAt,
    required super.issuedAt,
  });

  /// Create AuthResultModel from JSON (API response)
  /// Expected format from login/register endpoints:
  /// {
  ///   "return_code": "SUCCESS",
  ///   "user": { "id": 123, "email": "...", ... },
  ///   "token": "eyJhbGci...",
  ///   "session_info": {
  ///     "expires_at": "2025-04-15T10:30:00Z",
  ///     "issued_at": "2025-01-15T10:30:00Z"
  ///   }
  /// }
  factory AuthResultModel.fromJson(Map<String, dynamic> json) {
    final sessionInfo = json['session_info'] as Map<String, dynamic>;

    return AuthResultModel(
      user: UserModel.fromJson(json['user'] as Map<String, dynamic>),
      token: json['token'] as String,
      expiresAt: DateTime.parse(sessionInfo['expires_at'] as String),
      issuedAt: DateTime.parse(sessionInfo['issued_at'] as String),
    );
  }

  /// Convert AuthResultModel to AuthResult entity
  AuthResult toEntity() {
    return AuthResult(
      user: user,
      token: token,
      expiresAt: expiresAt,
      issuedAt: issuedAt,
    );
  }
}
