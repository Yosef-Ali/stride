import { queries } from '../../../src/server/db';
import { getActorId, getDb, unauthorized } from '../../../src/server/context';

export async function GET(req: Request) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();

  const db = getDb();
  const circles = await queries.getMyCircles(db, actorId);
  return Response.json({ circles });
}
