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

  // Cache keys
  static const String _userCacheKey = 'cached_user';

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
    // Try to get cached user data
    final userJson = _prefs.getString(_userCacheKey);
    if (userJson != null) {
      try {
        // Parse cached user data
        // For now, return null - will implement full caching later
        // This is a simplified version for Phase 1
        return null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  @override
  Future<void> logout() async {
    // Clear token from secure storage
    await _tokenStorage.deleteToken();

    // Clear cached user data
    await _prefs.remove(_userCacheKey);
  }

  /// Cache user data locally for offline access
  Future<void> _cacheUser(User user) async {
    // Simplified caching for Phase 1
    // Store user ID for future reference
    await _prefs.setInt('user_id', user.id);
    await _prefs.setString('user_email', user.email);
    await _prefs.setString('user_display_name', user.displayName);
  }
}
