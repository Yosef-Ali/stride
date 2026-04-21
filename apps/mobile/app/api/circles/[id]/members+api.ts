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
  const members = await queries.getCircleMembers(db, actorId, id);
  if (members === null) {
    return Response.json({ error: 'not a member' }, { status: 403 });
  }
  return Response.json({ members });
}
