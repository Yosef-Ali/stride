import { queries } from '../../../src/server/db';
import { badRequest, getDb } from '../../../src/server/context';

export async function POST(req: Request) {
  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest('invalid json');
  }
  const email = body.email?.trim();
  const code = body.code?.trim();
  if (!email || !code) return badRequest('email and code required');
  if (!/^\d{6}$/.test(code)) return badRequest('code must be 6 digits');

  const db = getDb();
  const result = await queries.verifyOtp(db, email, code);
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
