import { queries } from '../../../src/server/db';
import {
  badRequest,
  getActorId,
  getDb,
  unauthorized,
} from '../../../src/server/context';

export async function POST(req: Request) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest('invalid json');
  }
  const code = body.code?.trim().toUpperCase();
  if (!code || code.length !== 8) return badRequest('invalid code');

  const db = getDb();
  const result = await queries.joinCircleByCode(db, actorId, code);
  if (!result) {
    return Response.json({ error: 'circle not found' }, { status: 404 });
  }
  if ('full' in result) {
    return Response.json({ error: 'circle is full' }, { status: 409 });
  }
  return Response.json({ circle: result });
}
