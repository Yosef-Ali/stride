import { queries } from '../../../../src/server/db';
import {
  getActorId,
  getDb,
  unauthorized,
} from '../../../../src/server/context';

export async function GET(req: Request, { id }: { id: string }) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();

  const db = getDb();
  const winners = await queries.getCircleWinners(db, actorId, id, 4);
  if (winners === null) {
    return Response.json({ error: 'not a member' }, { status: 403 });
  }
  return Response.json({ winners });
}
