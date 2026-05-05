package expo.modules.stridesteps

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service that holds the step-counter sensor subscription so
 * the OS keeps our process alive. Without this, Samsung's Freecess /
 * Adaptive Battery aggressively kills the app even while it's in the
 * foreground, dropping sensor events and sometimes the entire process.
 *
 * The service itself does no work — it just bumps a refcount on
 * `StepSensorBridge` so the listener stays registered, and shows a
 * persistent notification so Android lets us live.
 */
class StepTrackingService : Service() {
  companion object {
    private const val CHANNEL_ID = "stride.steps.tracking"
    private const val NOTIFICATION_ID = 4711

    fun start(context: Context) {
      val intent = Intent(context, StepTrackingService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, StepTrackingService::class.java))
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private var retryCount = 0
  private val handler = android.os.Handler(android.os.Looper.getMainLooper())

  override fun onCreate() {
    super.onCreate()
    ensureChannel()
    retryCount = 0
    tryStartForeground()
  }

  private fun tryStartForeground() {
    try {
      startForegroundCompat(buildNotification())
      StepSensorBridge.acquire(this)
    } catch (e: Throwable) {
      if (retryCount < 10) {
        retryCount++
        android.util.Log.w("StrideSteps", "startForeground attempt $retryCount failed, retrying in 1s", e)
        handler.postDelayed({ tryStartForeground() }, 1_000)
      } else {
        android.util.Log.e("StrideSteps", "startForeground failed after 10 retries, giving up", e)
        stopSelf()
      }
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // START_STICKY: if the system kills us under memory pressure, restart
    // when resources free up. Sensor re-registers via onCreate().
    return START_STICKY
  }

  override fun onDestroy() {
    StepSensorBridge.release()
    super.onDestroy()
  }

  private fun startForegroundCompat(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      // Android 14+: must declare the foregroundServiceType at startForeground time.
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Step tracking",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Keeps your step count up to date in the background."
      setShowBadge(false)
    }
    nm.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    val pi = launchIntent?.let {
      PendingIntent.getActivity(this, 0, it, flags)
    }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Stride is tracking your steps")
      .setContentText("Tap to open")
      .setSmallIcon(applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_menu_directions)
      .setOngoing(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .apply { if (pi != null) setContentIntent(pi) }
      .build()
  }
}
