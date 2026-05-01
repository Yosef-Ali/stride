import {
  requireNativeModule,
  EventEmitter,
  type EventSubscription,
} from 'expo-modules-core';
import { Platform } from 'react-native';

const EVENT_COUNTER = 'onStepCounterUpdate' as const;

type StrideStepsModule = {
  /**
   * Returns the cumulative step count since last device reboot, read directly
   * from `Sensor.TYPE_STEP_COUNTER`. The first call lazily registers a long-
   * lived sensor listener; subsequent calls resolve instantly with the cached
   * value. If no event has arrived yet (e.g. user is sitting still and just
   * granted permission), the promise queues and resolves on the next event.
   *
   * Throws "ERR_NO_SENSOR" on devices without a step-counter sensor.
   * Throws "ERR_TIMEOUT" if no sensor event has arrived within 30s.
   */
  getCumulativeStepsAsync(): Promise<number>;

  /**
   * Register the native STEP_COUNTER sensor listener. Idempotent —
   * bumps a refcount on repeated calls. Returns false if the device
   * has no step counter or if ACTIVITY_RECOGNITION isn't granted yet
   * (caller should prompt for permission and retry). Use this after
   * a runtime permission grant to recover from a pre-grant boot where
   * the module's eager OnCreate acquire was a no-op.
   */
  acquireSensorAsync(): Promise<boolean>;

  /**
   * Start a foreground service that holds the step-counter subscription
   * even when the app is backgrounded or Samsung's Freecess tries to put
   * us to sleep. Shows a low-priority persistent notification ("Stride
   * is tracking your steps"). Idempotent.
   */
  startBackgroundTrackingAsync(): Promise<void>;

  /** Stop the foreground service and dismiss the persistent notification. */
  stopBackgroundTrackingAsync(): Promise<void>;

  /** No-op. Required by Expo's EventEmitter contract. */
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

export type StepCounterUpdateEvent = {
  /** Cumulative steps since last device reboot, raw from the OS sensor. */
  cumulative: number;
};

// Defensive: don't crash the JS bundle on import if the native module isn't
// registered — e.g. running in Expo Go, or a dev client built before the
// module was added. The hooks below silently no-op in that case so the app
// still loads and falls back to server-side step data.
let native: StrideStepsModule | null = null;
if (Platform.OS === 'android') {
  try {
    native = requireNativeModule('StrideSteps') as StrideStepsModule;
  } catch (err) {
    if (__DEV__) {
      console.warn(
        '[stride-steps] native module not registered — live step counter disabled. Rebuild the dev client to enable it.',
        err,
      );
    }
  }
}

const emitter: EventEmitter | null = native ? new EventEmitter(native) : null;

export async function getCumulativeStepsAsync(): Promise<number> {
  if (!native) {
    const err: any = new Error('stride-steps native module unavailable');
    err.code = 'ERR_NO_SENSOR';
    throw err;
  }
  return native.getCumulativeStepsAsync();
}

export async function acquireSensorAsync(): Promise<boolean> {
  if (!native) return false;
  return native.acquireSensorAsync();
}

export async function startBackgroundTrackingAsync(): Promise<void> {
  if (!native) return;
  return native.startBackgroundTrackingAsync();
}

export async function stopBackgroundTrackingAsync(): Promise<void> {
  if (!native) return;
  return native.stopBackgroundTrackingAsync();
}

/**
 * Subscribe to push notifications from the native step-counter sensor. The
 * listener is invoked every time the OS delivers a new sensor reading
 * (~every 1-2s while the user is walking on Samsung devices). On iOS / web,
 * returns a no-op subscription.
 */
export function addStepCounterListener(
  callback: (event: StepCounterUpdateEvent) => void,
): EventSubscription {
  if (!emitter) {
    return { remove: () => {} } as EventSubscription;
  }
  return emitter.addListener<StepCounterUpdateEvent>(EVENT_COUNTER, callback);
}
