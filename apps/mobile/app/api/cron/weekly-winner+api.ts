import { queries } from '../../../src/server/db';
import { getDb } from '../../../src/server/context';

/**
 * Protected endpoint — intended to be triggered Monday 00:05 local
 * by an external scheduler. Idempotent: re-running on the same week
 * is a no-op thanks to the weekly_wins unique constraint.
 *
 * Auth: `authorization: Bearer <CRON_SECRET>` OR `x-cron-secret: <CRON_SECRET>`.
 *
 * NOTE: Vercel Cron only fires GET, so both GET and POST are exported.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: 'CRON_SECRET not configured on server' },
      { status: 500 },
    );
  }

  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const headerSecret = req.headers.get('x-cron-secret') ?? '';
  if (bearer !== secret && headerSecret !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const summary = await queries.crownWeeklyWinners(db);
  return Response.json(summary);
}

export const GET = run;
export const POST = run;