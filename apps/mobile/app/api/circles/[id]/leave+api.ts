import { queries } from '../../../../src/server/db';
import {
  getActorId,
  getDb,
  unauthorized,
} from '../../../../src/server/context';

export async function POST(req: Request, { id }: { id: string }) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();

  const db = getDb();
  const result = await queries.leaveCircle(db, actorId, id);
  if (!result.left) {
    const status = result.reason === 'owner cannot leave' ? 409 : 400;
    return Response.json(
      { error: result.reason ?? 'could not leave' },
      { status },
    );
  }
  return Response.json({ left: true });
}
