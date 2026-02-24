import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:lmslocal_flutter/core/config/app_config.dart';
import 'package:lmslocal_flutter/core/services/notification_service.dart';
import 'package:lmslocal_flutter/data/data_sources/local/token_storage.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/api_client.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/auth_remote_data_source.dart';
import 'package:lmslocal_flutter/data/data_sources/remote/version_remote_data_source.dart';
import 'package:lmslocal_flutter/data/repositories/auth_repository_impl.dart';
import 'package:lmslocal_flutter/domain/repositories/auth_repository.dart';
import 'package:lmslocal_flutter/presentation/bloc/auth/auth_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Dependency injection container
/// Simple service locator for Phase 1
class Injection {
  static late SharedPreferences _prefs;
  static late AppConfig _config;
  static late FlutterSecureStorage _secureStorage;
  static late TokenStorage _tokenStorage;
  static late ApiClient _apiClient;
  static late AuthRemoteDataSource _authRemoteDataSource;
  static late VersionRemoteDataSource _versionRemoteDataSource;
  static late AuthRepository _authRepository;
  static late NotificationService _notificationService;
  static late AuthBloc _authBloc;

  /// Initialize all dependencies
  static Future<void> init(AppConfig config) async {
    _config = config;

    // Core dependencies
    _prefs = await SharedPreferences.getInstance();
    _secureStorage = const FlutterSecureStorage();

    // Data sources
    _tokenStorage = TokenStorage(_secureStorage);
    _apiClient = ApiClient(
      config: _config,
      tokenStorage: _tokenStorage,
    );
    _authRemoteDataSource = AuthRemoteDataSource(_apiClient);
    _versionRemoteDataSource = VersionRemoteDataSource(apiClient: _apiClient);

    // Repositories
    _authRepository = AuthRepositoryImpl(
      remoteDataSource: _authRemoteDataSource,
      tokenStorage: _tokenStorage,
      prefs: _prefs,
    );

    // Services
    _notificationService = NotificationService(apiClient: _apiClient);

    // BLoCs (singletons so API client callbacks can reach them)
    _authBloc = AuthBloc(authRepository: _authRepository);
  }

  /// Get AuthBloc singleton instance
  static AuthBloc getAuthBloc() {
    return _authBloc;
  }

  /// Get ApiClient instance (for setting 401 callback)
  static ApiClient getApiClient() {
    return _apiClient;
  }

  /// Get AuthRepository instance
  static AuthRepository getAuthRepository() {
    return _authRepository;
  }

  /// Get TokenStorage instance
  static TokenStorage getTokenStorage() {
    return _tokenStorage;
  }

  /// Get VersionRemoteDataSource instance
  static VersionRemoteDataSource getVersionRemoteDataSource() {
    return _versionRemoteDataSource;
  }

  /// Get NotificationService instance
  static NotificationService getNotificationService() {
    return _notificationService;
  }
}
