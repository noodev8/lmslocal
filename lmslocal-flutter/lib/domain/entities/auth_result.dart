import 'package:equatable/equatable.dart';
import 'package:lmslocal_flutter/domain/entities/user.dart';

/// Result of authentication operations (login/register)
class AuthResult extends Equatable {
  final User user;
  final String token;
  final DateTime expiresAt;
  final DateTime issuedAt;

  const AuthResult({
    required this.user,
    required this.token,
    required this.expiresAt,
    required this.issuedAt,
  });

  @override
  List<Object?> get props => [user, token, expiresAt, issuedAt];
}
