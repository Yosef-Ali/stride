package expo.modules.stridesteps

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Process-wide owner of the `Sensor.TYPE_STEP_COUNTER` listener. Both
 * StrideStepsModule (when JS is attached) and StepTrackingService (the
 * foreground service that keeps us alive against Samsung Freecess) share
 * this state — registering the sensor twice would double-count.
 *
 * The latest reading is cached so a freshly-attached JS bridge can resolve
 * `getCumulativeStepsAsync` immediately without waiting for the next event.
 */
internal object StepSensorBridge {
  private const val TAG = "StrideSteps"

  @Volatile var latestCumulative: Double? = null
    private set

  /** Set by the module while JS is attached; null while detached. */
  @Volatile var sink: ((Double) -> Unit)? = null

  private var sensorManager: SensorManager? = null
  private var listener: SensorEventListener? = null
  private var refCount: Int = 0

  /**
   * Returns false if the device has no step-counter sensor, or if
   * ACTIVITY_RECOGNITION hasn't been granted yet. Callers are expected
   * to retry after the user accepts the runtime permission — registering
   * pre-grant on Android 10+ produces a sticky listener that never fires
   * even after the permission flips, so we defer entirely.
   */
  @Synchronized
  fun acquire(context: Context): Boolean {
    if (listener != null) {
      refCount++
      return true
    }
    if (!hasActivityRecognitionPermission(context)) {
      Log.d(TAG, "acquire skipped — ACTIVITY_RECOGNITION not granted yet")
      return false
    }
    val sm = context.applicationContext
      .getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return false
    val counter = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return false

    val l = object : SensorEventListener {
      override fun onSensorChanged(event: SensorEvent) {
        val value = event.values.firstOrNull()?.toDouble() ?: return
        latestCumulative = value
        sink?.invoke(value)
      }
      override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    }
    val ok = sm.registerListener(
      l,
      counter,
      SensorManager.SENSOR_DELAY_FASTEST,
      0, // maxReportLatencyUs = 0 → ask for no hardware batching
    )
    if (!ok) {
      Log.w(TAG, "registerListener(STEP_COUNTER) returned false")
      return false
    }
    sensorManager = sm
    listener = l
    refCount = 1
    Log.d(TAG, "STEP_COUNTER listener registered")
    return true
  }

  private fun hasActivityRecognitionPermission(context: Context): Boolean {
    // ACTIVITY_RECOGNITION runtime permission was added in Android 10
    // (API 29). Older versions implicitly grant it via manifest entry.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
    val granted = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACTIVITY_RECOGNITION,
    )
    return granted == PackageManager.PERMISSION_GRANTED
  }

  @Synchronized
  fun release() {
    if (refCount <= 0) return
    refCount--
    if (refCount > 0) return
    listener?.let { sensorManager?.unregisterListener(it) }
    listener = null
    sensorManager = null
    Log.d(TAG, "STEP_COUNTER listener unregistered")
  }
}
