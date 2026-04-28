import { users } from '../../../src/server/db/schema';
import { eq } from 'drizzle-orm';
import { badRequest, getDb } from '../../../src/server/context';

/**
 * Dev-only one-tap sign-in. Upserts a local dev user and returns it.
 * Disabled in production via NODE_ENV check.
 */
export async function POST(_req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return badRequest('disabled');
  }
  const db = getDb();
  const email = 'dev@local.test';
  const existing = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  const user =
    existing ??
    (
      await db
        .insert(users)
        .values({ email, name: 'Dev User' })
        .returning()
    )[0]!;
  return Response.json({
    user: { id: user.id, name: user.name, email: user.email },
  });
}
