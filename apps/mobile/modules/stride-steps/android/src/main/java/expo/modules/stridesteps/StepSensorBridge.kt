package expo.modules.stridesteps

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log

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

  /** Returns false if the device has no step-counter sensor. */
  @Synchronized
  fun acquire(context: Context): Boolean {
    if (listener != null) {
      refCount++
      return true
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
