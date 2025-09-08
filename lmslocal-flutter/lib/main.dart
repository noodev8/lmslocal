import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'screens/login_screen.dart';
import 'config/app_config.dart';

void main() {
  // Print current server configuration in debug mode
  debugPrint('🌐 LMS Local App starting...');
  debugPrint('📡 API Server: ${AppConfig.baseUrl}');
  
  runApp(
    const ProviderScope(
      child: LMSLocalApp(),
    ),
  );
}

class LMSLocalApp extends StatelessWidget {
  const LMSLocalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConfig.appName,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.light,
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.dark,
        ),
      ),
      home: const LoginScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}