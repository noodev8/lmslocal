import 'package:equatable/equatable.dart';

/// Base class for all failures
abstract class Failure extends Equatable {
  final String message;

  const Failure(this.message);

  @override
  List<Object?> get props => [message];
}

/// Server returned an error response
class ServerFailure extends Failure {
  final String? code;

  const ServerFailure(super.message, {this.code});

  @override
  List<Object?> get props => [message, code];
}

/// Network connectivity error
class NetworkFailure extends Failure {
  const NetworkFailure(super.message);
}

/// Authentication failure (invalid credentials, token expired, etc.)
class AuthFailure extends Failure {
  final String? code;

  const AuthFailure(super.message, {this.code});

  @override
  List<Object?> get props => [message, code];
}

/// Validation failure (invalid input)
class ValidationFailure extends Failure {
  const ValidationFailure(super.message);
}

/// Cache/storage failure
class CacheFailure extends Failure {
  const CacheFailure(super.message);
}
