import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../models/competition.dart';
import '../config/app_config.dart';

class ApiService {
  static ApiService? _instance;
  static ApiService get instance => _instance ??= ApiService._();
  
  late final Dio _dio;

  ApiService._() {
    _setupDio();
  }

  void _setupDio() {
    // Setup Dio with configuration from AppConfig
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.baseUrl,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      sendTimeout: AppConfig.sendTimeout,
      headers: {
        'Content-Type': 'application/json',
      },
    ));

    // Add interceptors
    _setupInterceptors();
  }

  void _setupInterceptors() {
    // Request interceptor - Add JWT token automatically
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        // Add JWT token if available
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('jwt_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onResponse: (response, handler) {
        handler.next(response);
      },
      onError: (error, handler) {
        // Handle auth errors
        if (error.response?.statusCode == 401) {
          _clearAuth();
        }
        handler.next(error);
      },
    ));

    // TODO: Add caching back later with proper Hive initialization
  }

  Future<void> _clearAuth() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    await prefs.remove('user');
  }

  // Authentication methods
  Future<LoginResponse> login(String email, String password) async {
    try {
      final response = await _dio.post('/login', data: {
        'email': email,
        'password': password,
      });
      
      final loginResponse = LoginResponse.fromJson(response.data);
      
      // Store token and user if login successful
      if (loginResponse.isSuccess && loginResponse.token != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('jwt_token', loginResponse.token!);
        if (loginResponse.user != null) {
          await prefs.setString('user', jsonEncode(loginResponse.user!.toJson()));
        }
      }
      
      return loginResponse;
    } on DioException catch (e) {
      String errorMessage = 'Network error';
      if (e.type == DioExceptionType.connectionTimeout) {
        errorMessage = 'Connection timeout - check server is running';
      } else if (e.type == DioExceptionType.receiveTimeout) {
        errorMessage = 'Server response timeout';
      } else if (e.type == DioExceptionType.connectionError) {
        errorMessage = 'Cannot connect to server - check network/URL';
      }
      
      return LoginResponse(
        returnCode: 'SERVER_ERROR',
        message: '$errorMessage: ${e.message}',
      );
    } catch (e) {
      return LoginResponse(
        returnCode: 'CLIENT_ERROR',
        message: 'Unexpected error: $e',
      );
    }
  }

  Future<LoginResponse> register(String email, String password, String displayName) async {
    try {
      final response = await _dio.post('/register', data: {
        'email': email,
        'password': password,
        'display_name': displayName,
        'name': displayName, // API expects both name and display_name
        'confirmPassword': password,
      });
      
      final loginResponse = LoginResponse.fromJson(response.data);
      
      // Store token and user if registration successful
      if (loginResponse.isSuccess && loginResponse.token != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('jwt_token', loginResponse.token!);
        if (loginResponse.user != null) {
          await prefs.setString('user', jsonEncode(loginResponse.user!.toJson()));
        }
      }
      
      return loginResponse;
    } on DioException catch (e) {
      return LoginResponse(
        returnCode: 'SERVER_ERROR',
        message: 'Network error: ${e.message}',
      );
    } catch (e) {
      return LoginResponse(
        returnCode: 'CLIENT_ERROR',
        message: 'Unexpected error: $e',
      );
    }
  }

  Future<void> logout() async {
    await _clearAuth();
  }

  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token') != null;
  }

  Future<User?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userString = prefs.getString('user');
    if (userString != null) {
      try {
        // Parse the actual stored user JSON data
        final userJson = jsonDecode(userString) as Map<String, dynamic>;
        return User.fromJson(userJson);
      } catch (e) {
        // Clear corrupted user data
        await prefs.remove('user');
        return null;
      }
    }
    return null;
  }

  Future<LoginResponse> forgotPassword(String email) async {
    try {
      final response = await _dio.post('/forgot-password', data: {
        'email': email,
      });
      
      return LoginResponse.fromJson(response.data);
    } on DioException catch (e) {
      return LoginResponse(
        returnCode: 'SERVER_ERROR',
        message: 'Network error: ${e.message}',
      );
    } catch (e) {
      return LoginResponse(
        returnCode: 'CLIENT_ERROR',
        message: 'Unexpected error: $e',
      );
    }
  }

  Future<LoginResponse> changePassword(String currentPassword, String newPassword) async {
    try {
      final response = await _dio.post('/change-password', data: {
        'current_password': currentPassword,
        'new_password': newPassword,
      });
      
      return LoginResponse.fromJson(response.data);
    } on DioException catch (e) {
      return LoginResponse(
        returnCode: 'SERVER_ERROR',
        message: 'Network error: ${e.message}',
      );
    } catch (e) {
      return LoginResponse(
        returnCode: 'CLIENT_ERROR',
        message: 'Unexpected error: $e',
      );
    }
  }

  Future<LoginResponse> updateProfile(String displayName) async {
    try {
      final response = await _dio.post('/update-profile', data: {
        'display_name': displayName,
      });
      
      return LoginResponse.fromJson(response.data);
    } on DioException catch (e) {
      return LoginResponse(
        returnCode: 'SERVER_ERROR',
        message: 'Network error: ${e.message}',
      );
    } catch (e) {
      return LoginResponse(
        returnCode: 'CLIENT_ERROR',
        message: 'Unexpected error: $e',
      );
    }
  }

  Future<LoginResponse> deleteAccount(String confirmation) async {
    try {
      final response = await _dio.post('/delete-account', data: {
        'confirmation': confirmation,
      });
      
      return LoginResponse.fromJson(response.data);
    } on DioException catch (e) {
      return LoginResponse(
        returnCode: 'SERVER_ERROR',
        message: 'Network error: ${e.message}',
      );
    } catch (e) {
      return LoginResponse(
        returnCode: 'CLIENT_ERROR',
        message: 'Unexpected error: $e',
      );
    }
  }

  Future<CompetitionsResponse> getMyCompetitions() async {
    try {
      final response = await _dio.post('/get-user-dashboard', data: {});
      
      return CompetitionsResponse.fromJson(response.data);
    } on DioException catch (e) {
      String errorMessage = 'Network error';
      if (e.type == DioExceptionType.connectionTimeout) {
        errorMessage = 'Connection timeout - check server is running';
      } else if (e.type == DioExceptionType.receiveTimeout) {
        errorMessage = 'Server response timeout';
      } else if (e.type == DioExceptionType.connectionError) {
        errorMessage = 'Cannot connect to server - check network/URL';
      } else if (e.response?.statusCode == 401) {
        errorMessage = 'Unauthorized - check login status';
      }
      
      return CompetitionsResponse(
        returnCode: 'SERVER_ERROR',
        competitions: [],
        message: '$errorMessage: ${e.message}',
      );
    } catch (e) {
      return CompetitionsResponse(
        returnCode: 'CLIENT_ERROR',
        competitions: [],
        message: 'Unexpected error: $e',
      );
    }
  }

  Future<CompetitionsResponse> getPlayerDashboard() async {
    try {
      final response = await _dio.post('/player-dashboard', data: {});
      
      return CompetitionsResponse.fromJson(response.data);
    } on DioException catch (e) {
      return CompetitionsResponse(
        returnCode: 'SERVER_ERROR',
        competitions: [],
        message: 'Network error: ${e.message}',
      );
    } catch (e) {
      return CompetitionsResponse(
        returnCode: 'CLIENT_ERROR',
        competitions: [],
        message: 'Unexpected error: $e',
      );
    }
  }

}