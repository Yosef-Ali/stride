/**
 * Thin wrapper around react-native-health-connect. Safe to import on any
 * platform — methods no-op on iOS / web so call sites don't need Platform
 * checks everywhere.
 */
import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

const STEPS_PERM = { accessType: 'read', recordType: 'Steps' } as const;
const DISTANCE_PERM = { accessType: 'read', recordType: 'Distance' } as const;

export type SyncResult =
  | { ok: true; steps: number; distanceKm: number }
  | { ok: false; reason: 'unsupported' | 'not-installed' | 'denied' | 'error'; message?: string };

/**
 * Ask the user to grant step + distance read permissions. Returns whether
 * we have both after the dialog dance.
 */
export async function ensureHealthConnect(): Promise<
  { ok: true } | { ok: false; reason: 'unsupported' | 'not-installed' | 'denied' }
> {
  if (Platform.OS !== 'android') return { ok: false, reason: 'unsupported' };

  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) return { ok: false, reason: 'unsupported' };
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return { ok: false, reason: 'not-installed' };
  }

  const inited = await initialize();
  if (!inited) return { ok: false, reason: 'unsupported' };

  const granted = await requestPermission([STEPS_PERM, DISTANCE_PERM]);
  const hasSteps = granted.some(
    (p) => p.recordType === 'Steps' && p.accessType === 'read',
  );
  if (!hasSteps) return { ok: false, reason: 'denied' };
  return { ok: true };
}

/**
 * Read today's step total (midnight → now, device local time) and, if
 * available, the distance sample sum. Falls back to a step-based estimate
 * when no distance records exist.
 */
export async function readTodaysActivity(): Promise<SyncResult> {
  const gate = await ensureHealthConnect();
  if (!gate.ok) return { ok: false, reason: gate.reason };

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  try {
    const stepsRes = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: now.toISOString(),
      },
    });
    const steps = (stepsRes.records ?? []).reduce(
      (sum, r) => sum + (typeof r.count === 'number' ? r.count : 0),
      0,
    );

    let distanceMeters = 0;
    try {
      const distRes = await readRecords('Distance', {
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: now.toISOString(),
        },
      });
      distanceMeters = (distRes.records ?? []).reduce((sum, r) => {
        const m = r?.distance?.inMeters;
        return sum + (typeof m === 'number' ? m : 0);
      }, 0);
    } catch {
      // Distance may not be granted or not available — we'll estimate.
    }

    // If we don't have a direct distance reading, estimate from steps.
    // Rule of thumb: ~1,350 steps per km for an average adult stride.
    const distanceKm =
      distanceMeters > 0 ? distanceMeters / 1000 : steps / 1350;

    return {
      ok: true,
      steps,
      distanceKm: Math.round(distanceKm * 100) / 100,
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
