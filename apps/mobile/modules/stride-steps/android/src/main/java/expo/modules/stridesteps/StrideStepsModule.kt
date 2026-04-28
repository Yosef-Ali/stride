package expo.modules.stridesteps

import android.os.Handler
import android.os.Looper
import android.util.Log
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TAG = "StrideSteps"
private const val EVENT_COUNTER = "onStepCounterUpdate"

/**
 * JS-facing surface of the step counter. The actual sensor subscription
 * lives in `StepSensorBridge` (singleton), held alive by either this
 * module (foreground only) or `StepTrackingService` (background-safe
 * foreground service). When JS attaches we pipe bridge values to JS;
 * when it detaches we let the service keep counting.
 */
class StrideStepsModule : Module() {
  private val pendingPromises = mutableListOf<Promise>()
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("StrideSteps")

    Events(EVENT_COUNTER)

    OnCreate {
      // Wire the bridge to JS. Acquire the sensor too so the listener
      // is alive even if the user never starts the foreground service.
      StepSensorBridge.sink = { value ->
        try {
          sendEvent(EVENT_COUNTER, mapOf("cumulative" to value))
        } catch (_: Throwable) {
          // sendEvent can throw during JS bridge shutdown — ignore.
        }
        val toResolve = synchronized(pendingPromises) {
          val copy = pendingPromises.toList()
          pendingPromises.clear()
          copy
        }
        toResolve.forEach { it.resolve(value) }
      }
      appContext.reactContext?.let { StepSensorBridge.acquire(it) }
    }

    OnDestroy {
      StepSensorBridge.sink = null
      appContext.reactContext?.let { _ -> StepSensorBridge.release() }
      synchronized(pendingPromises) {
        pendingPromises.forEach {
          it.reject("ERR_DESTROYED", "Module destroyed", null)
        }
        pendingPromises.clear()
      }
    }

    AsyncFunction("getCumulativeStepsAsync") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_NO_CONTEXT", "React context unavailable", null)
        return@AsyncFunction
      }

      val cached = StepSensorBridge.latestCumulative
      if (cached != null) {
        promise.resolve(cached)
        return@AsyncFunction
      }

      // OnCreate already tried to acquire; if that failed (no sensor on
      // this device) latestCumulative will stay null forever — bail now
      // instead of waiting 30s for a timeout.
      if (!StepSensorBridge.acquire(context)) {
        promise.reject(
          "ERR_NO_SENSOR",
          "Step-counter sensor not available on this device",
          null,
        )
        return@AsyncFunction
      }
      StepSensorBridge.release()

      synchronized(pendingPromises) { pendingPromises.add(promise) }

      mainHandler.postDelayed({
        val stillPending = synchronized(pendingPromises) {
          pendingPromises.remove(promise)
        }
        if (stillPending) {
          Log.w(TAG, "promise timed out (30s) — no sensor event received")
          promise.reject(
            "ERR_TIMEOUT",
            "No step event in 30s. Walk a few steps or check the ACTIVITY_RECOGNITION permission.",
            null,
          )
        }
      }, 30_000)
    }

    AsyncFunction("startBackgroundTrackingAsync") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_NO_CONTEXT", "React context unavailable", null)
        return@AsyncFunction
      }
      try {
        StepTrackingService.start(context)
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("ERR_START_SERVICE", e.message ?: "failed to start service", e)
      }
    }

    AsyncFunction("stopBackgroundTrackingAsync") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      try {
        StepTrackingService.stop(context)
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("ERR_STOP_SERVICE", e.message ?: "failed to stop service", e)
      }
    }
  }
}
