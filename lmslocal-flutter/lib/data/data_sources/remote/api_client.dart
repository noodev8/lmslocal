import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:lmslocal_flutter/core/config/app_config.dart';
import 'package:lmslocal_flutter/data/data_sources/local/token_storage.dart';

/// API client with Dio HTTP client
/// Handles all HTTP requests with automatic JWT token injection and 401 handling
class ApiClient {
  final Dio _dio;
  final TokenStorage _tokenStorage;

  /// Callback for handling 401 unauthorized errors
  /// Should navigate user to login screen and clear token
  Function(String message)? onUnauthorized;

  ApiClient({
    required AppConfig config,
    required TokenStorage tokenStorage,
  })  : _dio = Dio(),
        _tokenStorage = tokenStorage {
    // Configure Dio with base URL and timeout
    _dio.options.baseUrl = config.apiBaseUrl;
    _dio.options.connectTimeout = Duration(milliseconds: config.apiTimeout);
    _dio.options.receiveTimeout = Duration(milliseconds: config.apiTimeout);
    _dio.options.headers['Content-Type'] = 'application/json';

    // Add request interceptor to inject JWT token
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Inject JWT token if available
          final token = await _tokenStorage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }

          if (config.enableLogging) {
            debugPrint('🌐 REQUEST: ${options.method} ${options.path}');
            debugPrint('📤 DATA: ${options.data}');
          }

          return handler.next(options);
        },
        onResponse: (response, handler) {
          if (config.enableLogging) {
            debugPrint('✅ RESPONSE: ${response.statusCode} ${response.requestOptions.path}');
            debugPrint('📥 DATA: ${response.data}');
          }
          return handler.next(response);
        },
        onError: (error, handler) async {
          if (config.enableLogging) {
            debugPrint('❌ ERROR: ${error.response?.statusCode} ${error.requestOptions.path}');
            debugPrint('📥 ERROR DATA: ${error.response?.data}');
          }

          // Handle 401 Unauthorized - token expired or invalid
          if (error.response?.statusCode == 401) {
            await _handleUnauthorized();

            // Don't propagate 401 to UI - return custom error instead
            return handler.reject(
              DioException(
                requestOptions: error.requestOptions,
                error: 'Your session has expired. Please log in again.',
                type: DioExceptionType.cancel,
              ),
            );
          }

          return handler.next(error);
        },
      ),
    );
  }

  /// Handle 401 unauthorized response
  /// Clears token and notifies app to navigate to login
  Future<void> _handleUnauthorized() async {
    // Clear JWT token from secure storage
    await _tokenStorage.deleteToken();

    // Notify app to navigate to login (if callback is set)
    if (onUnauthorized != null) {
      onUnauthorized!('Your session has expired. Please log in again.');
    }
  }

  /// POST request
  Future<Response> post(
    String path, {
    Map<String, dynamic>? data,
    Map<String, dynamic>? queryParameters,
  }) async {
    return await _dio.post(
      path,
      data: data,
      queryParameters: queryParameters,
    );
  }

  /// GET request
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    return await _dio.get(
      path,
      queryParameters: queryParameters,
    );
  }

  /// PUT request
  Future<Response> put(
    String path, {
    Map<String, dynamic>? data,
    Map<String, dynamic>? queryParameters,
  }) async {
    return await _dio.put(
      path,
      data: data,
      queryParameters: queryParameters,
    );
  }

  /// DELETE request
  Future<Response> delete(
    String path, {
    Map<String, dynamic>? data,
    Map<String, dynamic>? queryParameters,
  }) async {
    return await _dio.delete(
      path,
      data: data,
      queryParameters: queryParameters,
    );
  }
}
