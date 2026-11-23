import 'package:equatable/equatable.dart';

/// Base class for all failures
abstract class Failure extends Equatable {
  final String message;

  const Failure(this.message);

  // runtimeType is a prop because Equatable 3 stopped comparing it: without it
  // a NetworkFailure and a ValidationFailure with the same message are equal.
  // Subclasses add their fields with `...super.props`.
  @override
  List<Object?> get props => [runtimeType, message];

  // Failures reach the user as `$e` in SnackBars. Equatable 3 dropped the
  // toString that printed the class and props, so without this they would read
  // "Instance of 'ServerFailure'" — and the message is all the user needs.
  @override
  String toString() => message;
}

/// Server returned an error response
class ServerFailure extends Failure {
  final String? code;

  const ServerFailure(super.message, {this.code});

  @override
  List<Object?> get props => [...super.props, code];
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
  List<Object?> get props => [...super.props, code];
}

/// Validation failure (invalid input)
class ValidationFailure extends Failure {
  const ValidationFailure(super.message);
}

/// Cache/storage failure
class CacheFailure extends Failure {
  const CacheFailure(super.message);
}

