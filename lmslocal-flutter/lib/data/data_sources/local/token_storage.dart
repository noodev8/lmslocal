import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:lmslocal_flutter/core/constants/app_constants.dart';

/// Secure token storage service
/// Handles JWT token storage and retrieval using flutter_secure_storage
class TokenStorage {
  final FlutterSecureStorage _secureStorage;

  TokenStorage(this._secureStorage);

  /// Save JWT token securely
  Future<void> saveToken(String token) async {
    await _secureStorage.write(
      key: AppConstants.tokenKey,
      value: token,
    );
  }

  /// Retrieve JWT token
  Future<String?> getToken() async {
    return await _secureStorage.read(key: AppConstants.tokenKey);
  }

  /// Delete JWT token (logout)
  Future<void> deleteToken() async {
    await _secureStorage.delete(key: AppConstants.tokenKey);
  }

  /// Check if token exists
  Future<bool> hasToken() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}
