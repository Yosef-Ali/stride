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

// React Native's fetch has no default timeout — without this, a cold-
// starting Vercel function or a flaky cell connection leaves the UI
// stuck on the loading skeleton until the user force-quits the app.
const REQUEST_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: headers(),
    cache: 'no-store',
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  let res: Response;
  try {
    res = await fetchWithTimeout(BASE + path, init);
  } catch (e: any) {
    // First call after install/idle hits a Vercel cold start — retry once
    // with a fresh timeout so the user doesn't see a spurious failure.
    if (method === 'GET' && (e?.name === 'AbortError' || /network/i.test(e?.message ?? ''))) {
      res = await fetchWithTimeout(BASE + path, init);
    } else {
      throw e;
    }
  }
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j?.error ?? `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}
