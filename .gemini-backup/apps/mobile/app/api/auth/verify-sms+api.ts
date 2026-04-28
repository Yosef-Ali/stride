import { queries } from '../../../src/server/db';
import { badRequest, getDb } from '../../../src/server/context';

/**
 * POST /api/auth/verify-sms — body: { phone, code }
 *
 * Mirrors /api/auth/verify but upserts the user by phone number instead of
 * email. First sign-in creates the account with a default name derived from
 * the last 4 digits — the user can rename in Me tab.
 */
export async function POST(req: Request) {
  let body: { phone?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest('invalid json');
  }
  const phone = body.phone?.trim();
  const code = body.code?.trim();
  if (!phone || !code) return badRequest('phone and code required');
  if (!/^\d{6}$/.test(code)) return badRequest('code must be 6 digits');

  const db = getDb();
  const result = await queries.verifyOtpByPhone(db, phone, code);
  if (!result.ok) {
    const status =
      result.reason === 'invalid'
        ? 401
        : result.reason === 'expired'
          ? 410
          : 429;
    return Response.json({ error: result.reason }, { status });
  }
  return Response.json({ user: result.user });
}
