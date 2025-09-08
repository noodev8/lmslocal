import 'package:json_annotation/json_annotation.dart';

part 'user.g.dart';

@JsonSerializable()
class User {
  final int id;
  final String email;
  @JsonKey(name: 'display_name')
  final String displayName;
  @JsonKey(name: 'is_managed')
  final bool? isManaged;
  @JsonKey(name: 'user_type')
  final String? userType;

  const User({
    required this.id,
    required this.email,
    required this.displayName,
    this.isManaged,
    this.userType,
  });

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
  Map<String, dynamic> toJson() => _$UserToJson(this);
}

@JsonSerializable()
class LoginResponse {
  @JsonKey(name: 'return_code')
  final String returnCode;
  final String? token;
  final User? user;
  final String? message;

  const LoginResponse({
    required this.returnCode,
    this.token,
    this.user,
    this.message,
  });

  factory LoginResponse.fromJson(Map<String, dynamic> json) => _$LoginResponseFromJson(json);
  Map<String, dynamic> toJson() => _$LoginResponseToJson(this);

  bool get isSuccess => returnCode == 'SUCCESS';
}