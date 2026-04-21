import { Resend } from 'resend';
import { queries } from '../../../src/server/db';
import { badRequest, getDb } from '../../../src/server/context';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FROM = 'Stride <onboarding@resend.dev>';

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

  // Send via Resend. If the send fails we still succeed the request so the
  // code isn't "wasted" — the caller can tap Resend and try again.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: 'Your Stride sign-in code',
        text: `Your code is ${result.code}\n\nIt expires in 10 minutes. If you didn't request this, you can ignore the email.`,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[otp] resend send failed', err);
    }
  } else {
    // eslint-disable-next-line no-console
    console.log(`[otp] ${email} → ${result.code} (no RESEND_API_KEY, skipped send)`);
  }

  return Response.json({ ok: true });
}
