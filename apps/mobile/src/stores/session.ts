/**
 * Session state: the currently-signed-in user and their active circle.
 * Persisted via AsyncStorage so reloads don't drop the login. Real auth
 * today is email OTP — see /api/auth/request and /api/auth/verify.
 *
 * Note: AsyncStorage is plain (not encrypted). Fine for a user id that the
 * server already trusts over a single header; revisit with expo-secure-store +
 * a dev build before shipping real PII or tokens.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const SESSION_KEY = 'stride.session.v1';

type PersistedSession = {
  userId: string;
  name: string;
};

type SessionState = {
  userId: string | null;
  name: string | null;
  circleId: string | null;
  circleName: string | null;
  inviteCode: string | null;
  hydrated: boolean;

  setUser: (u: { userId: string; name: string }) => Promise<void>;
  setActiveCircle: (c: {
    circleId: string;
    circleName: string;
    inviteCode: string;
  }) => void;
  hydrate: () => Promise<void>;
  signOut: () => Promise<void>;
};

const initial = {
  userId: null,
  name: null,
  circleId: null,
  circleName: null,
  inviteCode: null,
};

async function persist(s: PersistedSession | null) {
  if (s) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } else {
    await AsyncStorage.removeItem(SESSION_KEY);
  }
}

export const useSession = create<SessionState>((set, get) => ({
  ...initial,
  hydrated: false,

  setUser: async ({ userId, name }) => {
    set({ userId, name });
    await persist({ userId, name });
  },

  setActiveCircle: ({ circleId, circleName, inviteCode }) =>
    set({ circleId, circleName, inviteCode }),

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedSession;
        if (parsed.userId) {
          set({ userId: parsed.userId, name: parsed.name });
        }
      }
    } catch {
      // corrupt payload — fall through to unauthenticated
    } finally {
      set({ hydrated: true });
    }
  },

  signOut: async () => {
    set(initial);
    await persist(null);
  },
}));
