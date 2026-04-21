import { queries } from '../../src/server/db';
import { badRequest, getActorId, getDb, unauthorized } from '../../src/server/context';

export async function POST(req: Request) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest('invalid json');
  }
  const name = body.name?.trim();
  if (!name) return badRequest('name required');

  const db = getDb();
  try {
    const circle = await queries.createCircle(db, actorId, { name });
    return Response.json({ circle });
  } catch (e: any) {
    return Response.json(
      { error: e?.message ?? 'failed to create circle' },
      { status: 500 },
    );
  }
}
