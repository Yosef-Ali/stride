/**
 * Read today's step count from the phone's built-in step-counter sensor via
 * expo-sensors. No Health Connect / Samsung Health / Google Fit required —
 * the hardware pedometer is baked into every modern Android device.
 */
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

export type SyncResult =
  | { ok: true; steps: number; distanceKm: number }
  | { ok: false; reason: 'unsupported' | 'denied' | 'error'; message?: string };

/**
 * Read today's steps (midnight → now, device local time). On Android this
 * hits TYPE_STEP_COUNTER; on iOS it hits CMPedometer. Returns a best-effort
 * distance estimate (~1,350 steps/km).
 */
export async function readTodaysActivity(): Promise<SyncResult> {
  if (Platform.OS === 'web') {
    return { ok: false, reason: 'unsupported' };
  }

  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) return { ok: false, reason: 'unsupported' };

    // Ask for permission (ACTIVITY_RECOGNITION on Android, Motion & Fitness on iOS).
    const perm = await Pedometer.requestPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const { steps } = await Pedometer.getStepCountAsync(start, now);
    const distanceKm = Math.round((steps / 1350) * 100) / 100;

    return { ok: true, steps, distanceKm };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
