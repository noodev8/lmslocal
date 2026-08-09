package uk.co.lmslocal.lmslocal_flutter

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {

    companion object {
        /**
         * Must match the channelId in lmslocal-server/services/fcmService.js and the
         * default channel declared in AndroidManifest.xml. All three name the same
         * channel; if they ever disagree, notifications stop arriving.
         */
        private const val CHANNEL_ID = "lms_notifications"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()
    }

    /**
     * Android 8.0 refuses to display a notification whose channel does not exist, and it
     * does so silently — no error, nothing in logcat, the push simply never appears. The
     * server has always named a channel that nothing created, so this is what makes the
     * id it sends real.
     *
     * Creating it here is safe rather than lucky: a device cannot receive a push until it
     * has registered an FCM token, and it cannot register one until someone has opened
     * the app and signed in. The channel therefore always exists before the first
     * notification can be sent to this device.
     *
     * Creating a channel that already exists is a no-op, so this can run on every launch.
     * Note that the settings below are the *initial* ones only — once created, Android
     * hands the channel to the user and later changes here are ignored. Changing its
     * importance in future means a new channel id, not an edit.
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            // User-visible, in the system notification settings for the app.
            "Competition updates",
            // HIGH so a pick reminder can surface as a heads-up. These are time-bound —
            // a reminder seen after the round locks is worse than useless — and it
            // matches the priority the server sends.
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Results, and reminders to make your pick before a round locks."
        }

        val manager = getSystemService(NotificationManager::class.java)
        manager?.createNotificationChannel(channel)
    }
}
