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

  // Lifetime totals — used by the Me tab stats strip. Pulls every recorded
  // day so users with old accounts get an accurate total without paginating.
  const allDays = await queries.getMyStats(db, actorId, '1970-01-01', '2999-12-31');
  const totalKm = allDays.reduce((s, r) => s + Number(r.distanceKm), 0);
  const daysWalked = allDays.filter((r) => Number(r.distanceKm) > 0).length;
  const weeksActive = countDistinctIsoWeeks(allDays.map((r) => r.date));

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarColor: user.avatarColor,
      weeklyGoalKm: user.weeklyGoalKm,
      createdAt: user.createdAt,
    },
    lifetime: {
      totalKm: Number(totalKm.toFixed(2)),
      daysWalked,
      weeksActive,
    },
  });
}

function countDistinctIsoWeeks(dates: string[]): number {
  const seen = new Set<string>();
  for (const d of dates) {
    const [y, m, day] = d.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, day));
    // ISO week: Thursday-anchored
    const target = new Date(dt);
    const dayNum = (dt.getUTCDay() + 6) % 7;
    target.setUTCDate(dt.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const week =
      1 +
      Math.round(
        ((target.getTime() - firstThursday.getTime()) / 86400000 -
          ((firstThursday.getUTCDay() + 6) % 7) +
          3) /
          7,
      );
    seen.add(`${target.getUTCFullYear()}-W${week}`);
  }
  return seen.size;
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
