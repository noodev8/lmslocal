package uk.co.lmslocal.lmslocal_flutter

import android.os.Build
import android.os.Bundle
import androidx.core.view.WindowCompat
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Enable edge-to-edge display for Android 15+ compatibility
        // This ensures proper handling of system bars (status bar, navigation bar)
        // Flutter's SafeArea widgets will handle the insets
        WindowCompat.setDecorFitsSystemWindows(window, false)
    }
}
