import { queries } from '../../src/server/db';
import {
  badRequest,
  getActorId,
  getDb,
  unauthorized,
} from '../../src/server/context';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();

  let body: {
    date?: string;
    distanceKm?: number | string;
    steps?: number;
    activeMinutes?: number;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest('invalid json');
  }

  const date = body.date?.trim() ?? new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(date)) return badRequest('invalid date');

  const distanceKm = Number(body.distanceKm);
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 100) {
    return badRequest('invalid distanceKm');
  }

  const steps = Number(body.steps ?? 0);
  if (!Number.isFinite(steps) || steps < 0 || steps > 100_000) {
    return badRequest('invalid steps');
  }

  const activeMinutes = Number(body.activeMinutes ?? 0);
  if (
    !Number.isFinite(activeMinutes) ||
    activeMinutes < 0 ||
    activeMinutes > 1440
  ) {
    return badRequest('invalid activeMinutes');
  }

  const db = getDb();
  await queries.upsertOwnWalk(db, actorId, {
    date,
    distanceKm: distanceKm.toFixed(3),
    steps: Math.round(steps),
    activeMinutes: Math.round(activeMinutes),
  });
  return Response.json({ ok: true });
}
