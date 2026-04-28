import { users } from '../../../src/server/db/schema';
import { queries } from '../../../src/server/db';
import { badRequest, getDb } from '../../../src/server/context';

/**
 * POST /api/auth/bootstrap — body: { name?, code? }
 *
 * Device-bound sign-up: creates a new user row (no email, no phone, no OTP)
 * and — if an invite code is supplied — joins them into that circle in one
 * shot. Intended for the zero-friction onboarding path where all you have is
 * a code your friend shared via WhatsApp/Telegram. Account is tied to the
 * device since the client persists the returned userId. Losing the device
 * without the invite code = lose access — acceptable tradeoff for trusted
 * circles.
 */
export async function POST(req: Request) {
  let body: { name?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest('invalid json');
  }

  const rawName = body.name?.trim() ?? '';
  const name = rawName.length >= 1 && rawName.length <= 40
    ? rawName
    : `Walker ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const db = getDb();
  const [user] = await db.insert(users).values({ name }).returning();

  let circle: { id: string; name: string; inviteCode: string } | null = null;
  const code = body.code?.trim().toUpperCase();
  if (code) {
    const joined = await queries.joinCircleByCode(db, user!.id, code);
    if (!joined) return badRequest('invite code not found');
    circle = {
      id: joined.id,
      name: joined.name,
      inviteCode: joined.inviteCode,
    };
  }

  return Response.json({
    user: { id: user!.id, name: user!.name },
    circle,
  });
}
