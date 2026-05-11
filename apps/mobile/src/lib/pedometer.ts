/**
 * Reads today's step count on Android via a tiny custom Expo module that
 * snapshots `Sensor.TYPE_STEP_COUNTER`. The hardware counter keeps running
 * with the screen off and the app process killed, so we just need to read
 * its current value when the app comes back to foreground.
 *
 * Baseline strategy: persist {lastDate, lastCumulative, baselines:{date→cum}}
 * in AsyncStorage. For each new calendar day, baseline = yesterday's last
 * reading. If current < baseline, device rebooted (counter reset to 0) so
 * baseline becomes 0.
 */
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCumulativeStepsAsync } from 'stride-steps';

export const STEPS_PER_KM = 1350;
export const STEPS_PER_ACTIVE_MIN = 100;

export function stepsToDistanceKm(steps: number): number {
  return Math.round((steps / STEPS_PER_KM) * 100) / 100;
}

export function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type SyncResult =
  | { ok: true; steps: number; distanceKm: number }
  | { ok: false; reason: 'unsupported' | 'denied' | 'error'; message?: string };

const STATE_KEY = 'stride.pedometer.state.v3';
const SAVE_DEBOUNCE_MS = 5_000;

type State = {
  lastDate?: string;
  lastCumulative?: number;
  baselines: Record<string, number>;
};

let cachedState: State | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function ensureLoaded(): Promise<State> {
  if (cachedState) return cachedState;
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.baselines) {
        cachedState = parsed as State;
        return cachedState;
      }
    }
  } catch {
    // fall through to empty state
  }
  cachedState = { baselines: {} };
  return cachedState;
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (!cachedState) return;
    try {
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify(cachedState));
    } catch {
      // best-effort
    }
  }, SAVE_DEBOUNCE_MS);
}

function trimOldBaselines(state: State) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = `${cutoff.getFullYear()}-${String(
    cutoff.getMonth() + 1,
  ).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  for (const date of Object.keys(state.baselines)) {
    if (date < cutoffStr) delete state.baselines[date];
  }
}

/**
 * Convert a raw cumulative-since-boot reading into today's step count using
 * the persisted baseline. Mutates the in-memory cache and schedules a
 * debounced flush; safe to call on every sensor event.
 */
export async function computeTodayStepsFromCumulative(
  cumulative: number,
): Promise<{ steps: number; distanceKm: number }> {
  const today = todayLocal();
  const state = await ensureLoaded();
  const isNewDay = state.lastDate !== today;

  let baseline = state.baselines[today];
  if (baseline === undefined) {
    // When the app hasn't been opened for 2+ days, lastCumulative is stale
    // and all accumulated steps since then would be wrongly attributed to
    // today. Only carry over from yesterday (normal overnight gap); for
    // larger gaps start fresh so today's count begins at 0.
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    })();
    if (state.lastDate && state.lastDate >= yesterday) {
      baseline = state.lastCumulative ?? cumulative;
    } else {
      // Multi-day gap or first run — start fresh
      baseline = cumulative;
    }
    state.baselines[today] = baseline;
  }

  if (cumulative < baseline) {
    // Device rebooted — hardware counter reset to 0.
    baseline = 0;
    state.baselines[today] = 0;
  }

  const steps = Math.max(0, Math.round(cumulative - baseline));
  state.lastDate = today;
  state.lastCumulative = cumulative;

  if (isNewDay) trimOldBaselines(state);

  scheduleSave();
  return { steps, distanceKm: stepsToDistanceKm(steps) };
}

/** Read today's steps. Silent on the happy path. */
export async function readTodaysActivity(): Promise<SyncResult> {
  if (Platform.OS !== 'android') {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    const perm = await Pedometer.requestPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };
    const cumulative = await getCumulativeStepsAsync();
    const { steps, distanceKm } = await computeTodayStepsFromCumulative(
      cumulative,
    );
    return { ok: true, steps, distanceKm };
  } catch (err: any) {
    if (err?.code === 'ERR_NO_SENSOR') {
      return { ok: false, reason: 'unsupported' };
    }
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
