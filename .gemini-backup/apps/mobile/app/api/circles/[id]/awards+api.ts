import { queries } from '../../../../src/server/db';
import {
  getActorId,
  getDb,
  unauthorized,
} from '../../../../src/server/context';

/**
 * GET /api/circles/:id/awards?tz=<IANA>
 *
 * Returns the 3 most-recently-revealed weekly awards for this circle (Champion,
 * Most Improved, Most Consistent). Reveal cutoff is Sunday 10:00 local — before
 * that, the previous Sunday's reveal is still what you see. Lazy-computes on
 * first read so no cron job is strictly required.
 */
export async function GET(req: Request, { id }: { id: string }) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();

  const url = new URL(req.url);
  const tz = url.searchParams.get('tz') || 'UTC';

  const db = getDb();
  const result = await queries.getCircleAwards(db, actorId, id, tz);
  if (result === null) {
    return Response.json({ error: 'not a member' }, { status: 403 });
  }
  return Response.json(result);
}
