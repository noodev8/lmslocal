import 'package:equatable/equatable.dart';

/// Unpicked player entity
class UnpickedPlayer extends Equatable {
  final int userId;
  final String displayName;

  const UnpickedPlayer({
    required this.userId,
    required this.displayName,
  });

  @override
  List<Object?> get props => [userId, displayName];
}
