import 'package:equatable/equatable.dart';

/// User entity representing an authenticated user
class User extends Equatable {
  final int id;
  final String email;
  final String displayName;
  final bool emailVerified;
  final DateTime? lastLogin;

  const User({
    required this.id,
    required this.email,
    required this.displayName,
    required this.emailVerified,
    this.lastLogin,
  });

  @override
  List<Object?> get props => [id, email, displayName, emailVerified, lastLogin];
}
