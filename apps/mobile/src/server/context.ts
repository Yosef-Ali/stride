/**
 * Server-only helpers shared by API routes. Never import this from a component.
 */
import { createDb } from './db';
import * as path from 'node:path';

// Expo's built-in env loader only reads from the project root (apps/mobile).
// Our DATABASE_URL lives in the monorepo root .env — pull it in once.
let envLoaded = false;
function ensureEnv() {
  if (envLoaded) return;
  envLoaded = true;
  if (process.env.DATABASE_URL) return;
  try {
    // Lazy require so this only runs server-side.
    const dotenv = require('dotenv');
    // Walk up from CWD looking for a .env — robust to bundler layout.
    const fs = require('node:fs') as typeof import('node:fs');
    let dir = process.cwd();
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(dir, '.env');
      if (fs.existsSync(candidate)) {
        dotenv.config({ path: candidate });
        if (process.env.DATABASE_URL) return;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // dotenv not available at runtime — caller will throw a clearer error
  }
}

export function getDb() {
  ensureEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set on server');
  return createDb({ DATABASE_URL: url });
}

/**
 * Temporary actor resolution. Until email-OTP auth lands, the mobile client
 * sends its bootstrapped user id via `x-user-id`. Replace with a verified JWT
 * (Neon Auth or a custom signer) before shipping.
 */
export function getActorId(req: Request): string | null {
  const id = req.headers.get('x-user-id');
  if (!id) return null;
  // minimal uuid shape check so we don't hand junk to Postgres
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return null;
  return id;
}

export function unauthorized() {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}
