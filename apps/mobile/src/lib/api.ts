/**
 * Thin fetch wrapper for our Expo Router API routes.
 *
 * In dev, Metro serves /api/* from the same origin as the JS bundle, so a
 * relative URL works on web. On device (Expo Go / dev build) we need an
 * absolute base — resolved from Expo's debuggerHost.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useSession } from '../stores/session';

function resolveBaseUrl(): string {
  if (Platform.OS === 'web') return '';
  // In a production/standalone build, use the baked-in URL pointing at the
  // deployed Vercel API. Falls back to Metro's debuggerHost in dev.
  const baked = process.env.EXPO_PUBLIC_API_BASE;
  if (baked && baked.length > 0) return baked.replace(/\/$/, '');
  const hostCandidate =
    // @ts-expect-error legacy shape
    Constants.expoConfig?.hostUri ??
    // @ts-expect-error legacy shape
    Constants.manifest2?.extra?.expoClient?.hostUri ??
    // @ts-expect-error legacy shape
    Constants.manifest?.debuggerHost;
  if (!hostCandidate) return '';
  const host = String(hostCandidate).split('/')[0];
  return `http://${host}`;
}

const BASE = resolveBaseUrl();

function headers(): Record<string, string> {
  const uid = useSession.getState().userId;
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (uid) h['x-user-id'] = uid;
  return h;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'GET',
    headers: headers(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j?.error ?? `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}
