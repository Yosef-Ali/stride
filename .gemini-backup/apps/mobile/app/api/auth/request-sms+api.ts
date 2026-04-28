import twilio from 'twilio';
import { queries } from '../../../src/server/db';
import { badRequest, getDb } from '../../../src/server/context';

/**
 * POST /api/auth/request-sms — body: { phone }
 *
 * Generates a 6-digit OTP keyed by the normalized phone number (reuses the
 * email-flow OTP table since numbers in E.164 never collide with emails).
 * Delivers via Twilio if TWILIO_* env is set; otherwise logs the code so local
 * dev still works. If delivery fails we return ok anyway — the code is already
 * stored, and the caller can tap "Resend."
 */
export async function POST(req: Request) {
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest('invalid json');
  }

  const normalized = queries.normalizePhone(body.phone ?? '');
  if (!normalized) return badRequest('invalid phone');

  const db = getDb();
  const result = await queries.requestOtp(db, normalized);

  if ('rateLimited' in result) {
    return Response.json(
      { error: 'too many codes — wait a few minutes' },
      { status: 429 },
    );
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (sid && token && from) {
    try {
      const client = twilio(sid, token);
      await client.messages.create({
        to: normalized,
        from,
        body: `Your Stride code is ${result.code}. Expires in 10 minutes.`,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[sms-otp] twilio send failed', err);
    }
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `[sms-otp] ${normalized} → ${result.code} (no TWILIO_* env, skipped send)`,
    );
  }

  const includeDevCode =
    !(sid && token && from) || process.env.NODE_ENV !== 'production';
  return Response.json(
    includeDevCode ? { ok: true, devCode: result.code } : { ok: true },
  );
}
