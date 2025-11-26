package uk.co.lmslocal.lmslocal_flutter

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Enable edge-to-edge BEFORE super.onCreate() for Android 15+ compatibility
        // This properly handles system bars without using deprecated APIs
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
    }
}
