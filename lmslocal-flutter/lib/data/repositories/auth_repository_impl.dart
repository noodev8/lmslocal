import 'package:lmslocal_flutter/core/errors/failures.dart';
import 'package:lmslocal_flutter/data/data_sources/local/token_storage.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/auth_remote_data_source.dart';
import 'package:lmslocal_flutter/domain/entities/auth_result.dart';
import 'package:lmslocal_flutter/domain/entities/user.dart';
import 'package:lmslocal_flutter/domain/repositories/auth_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Authentication repository implementation
/// Handles authentication operations with token storage and caching
class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remoteDataSource;
  final TokenStorage _tokenStorage;
  final SharedPreferences _prefs;

  AuthRepositoryImpl({
    required AuthRemoteDataSource remoteDataSource,
    required TokenStorage tokenStorage,
    required SharedPreferences prefs,
  })  : _remoteDataSource = remoteDataSource,
        _tokenStorage = tokenStorage,
        _prefs = prefs;

  @override
  Future<({AuthResult? result, Failure? failure})> login({
    required String email,
    required String password,
  }) async {
    try {
      // Call API to login
      final authResultModel = await _remoteDataSource.login(
        email: email,
        password: password,
      );

      // Save token to secure storage
      await _tokenStorage.saveToken(authResultModel.token);

      // Cache user data locally
      await _cacheUser(authResultModel.user);

      return (result: authResultModel.toEntity(), failure: null);
    } on Failure catch (failure) {
      return (result: null, failure: failure);
    }
  }

  @override
  Future<({AuthResult? result, Failure? failure})> register({
    required String displayName,
    required String email,
    required String password,
  }) async {
    try {
      // Call API to register
      final authResultModel = await _remoteDataSource.register(
        displayName: displayName,
        email: email,
        password: password,
      );

      // Save token to secure storage
      await _tokenStorage.saveToken(authResultModel.token);

      // Cache user data locally
      await _cacheUser(authResultModel.user);

      return (result: authResultModel.toEntity(), failure: null);
    } on Failure catch (failure) {
      return (result: null, failure: failure);
    }
  }

  @override
  Future<({String? message, Failure? failure})> forgotPassword({
    required String email,
  }) async {
    try {
      final message = await _remoteDataSource.forgotPassword(email: email);
      return (message: message, failure: null);
    } on Failure catch (failure) {
      return (message: null, failure: failure);
    }
  }

  @override
  Future<bool> isAuthenticated() async {
    return await _tokenStorage.hasToken();
  }

  @override
  Future<User?> getCurrentUser() async {
    // Check if token exists first
    final hasToken = await _tokenStorage.hasToken();
    if (!hasToken) return null;

    // Try to get cached user data
    final userId = _prefs.getInt('user_id');
    final email = _prefs.getString('user_email');
    final displayName = _prefs.getString('user_display_name');
    final emailVerified = _prefs.getBool('user_email_verified') ?? true;

    // If we have cached user data, return it
    if (userId != null && email != null && displayName != null) {
      return User(
        id: userId,
        email: email,
        displayName: displayName,
        emailVerified: emailVerified,
      );
    }

    return null;
  }

  @override
  Future<void> logout() async {
    // Clear token from secure storage
    await _tokenStorage.deleteToken();

    // Clear cached user data
    await _prefs.remove('user_id');
    await _prefs.remove('user_email');
    await _prefs.remove('user_display_name');
    await _prefs.remove('user_email_verified');
  }

  /// Cache user data locally for persistent login
  Future<void> _cacheUser(User user) async {
    await _prefs.setInt('user_id', user.id);
    await _prefs.setString('user_email', user.email);
    await _prefs.setString('user_display_name', user.displayName);
    await _prefs.setBool('user_email_verified', user.emailVerified);
  }
}
