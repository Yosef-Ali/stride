import { queries } from '../../../src/server/db';
import { badRequest, getDb } from '../../../src/server/context';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest('invalid json');
  }
  const email = body.email?.trim();
  if (!email || !EMAIL_RE.test(email)) return badRequest('invalid email');

  const db = getDb();
  const result = await queries.requestOtp(db, email);

  if ('rateLimited' in result) {
    return Response.json(
      { error: 'too many codes — wait a few minutes' },
      { status: 429 },
    );
  }

  // Dev-only: print + echo the code so we can test without a real mailer.
  // Remove in step 12 when Resend ships.
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(`[otp] ${email} → ${result.code}`);
  }
  return Response.json({ ok: true, ...(isDev ? { devCode: result.code } : {}) });
}
