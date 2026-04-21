import { queries } from '../../../../src/server/db';
import {
  getActorId,
  getDb,
  unauthorized,
} from '../../../../src/server/context';

/** Monday of the current week (local), as YYYY-MM-DD. */
function thisWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...6=Sat
  const diffToMon = (day + 6) % 7; // days since Monday
  const mon = new Date(now);
  mon.setDate(now.getDate() - diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(mon), to: iso(sun) };
}

export async function GET(req: Request, { id }: { id: string }) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();

  const url = new URL(req.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const { from, to } =
    fromParam && toParam
      ? { from: fromParam, to: toParam }
      : thisWeekRange();

  const db = getDb();
  const rows = await queries.getCircleLeaderboard(db, actorId, id, from, to);
  if (rows === null) {
    return Response.json({ error: 'not a member' }, { status: 403 });
  }
  // Coerce numeric-string sums to floats for the client.
  const leaderboard = rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    name: r.name,
    avatarColor: r.avatarColor,
    distanceKm: Number(r.distanceKm),
    activeMinutes: Number(r.activeMinutes),
  }));
  return Response.json({ from, to, leaderboard });
}
