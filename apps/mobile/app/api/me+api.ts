import { queries } from '../../src/server/db';
import {
  badRequest,
  getActorId,
  getDb,
  unauthorized,
} from '../../src/server/context';

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function GET(req: Request) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();
  const db = getDb();
  const user = await queries.getUser(db, actorId);
  if (!user) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarColor: user.avatarColor,
      weeklyGoalKm: user.weeklyGoalKm,
    },
  });
}

export async function PATCH(req: Request) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();

  let body: {
    name?: string;
    avatarColor?: string;
    weeklyGoalKm?: number | string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest('invalid json');
  }

  const patch: {
    name?: string;
    avatarColor?: string;
    weeklyGoalKm?: string;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 40) return badRequest('invalid name');
    patch.name = name;
  }
  if (body.avatarColor !== undefined) {
    const c = String(body.avatarColor);
    if (!HEX.test(c)) return badRequest('invalid avatarColor');
    patch.avatarColor = c;
  }
  if (body.weeklyGoalKm !== undefined) {
    const n = Number(body.weeklyGoalKm);
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      return badRequest('invalid weeklyGoalKm');
    }
    patch.weeklyGoalKm = n.toFixed(2);
  }

  const db = getDb();
  const user = await queries.updateMyProfile(db, actorId, patch);
  if (!user) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarColor: user.avatarColor,
      weeklyGoalKm: user.weeklyGoalKm,
    },
  });
}
