import { queries } from '../../src/server/db';
import { getActorId, getDb, unauthorized } from '../../src/server/context';

function iso(d: Date) {
  // UTC-based YYYY-MM-DD so clients and server stay on the same calendar day
  // regardless of the server's local timezone.
  return d.toISOString().slice(0, 10);
}

/**
 * Home screen payload: today's totals + the Mon→Sun bars for the current week.
 * Zero-fills gaps so the UI can always render 7 bars. All dates are UTC — a
 * phone in any timezone sends its local YYYY-MM-DD and we compare string-wise.
 */
export async function GET(req: Request) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();

  // Use UTC date arithmetic so the server timezone doesn't shift the week.
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = today.getUTCDay(); // 0=Sun..6=Sat
  const diffToMon = (day + 6) % 7;
  const weekStart = new Date(today);
  weekStart.setUTCDate(today.getUTCDate() - diffToMon);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const db = getDb();
  const rows = await queries.getMyStats(
    db,
    actorId,
    iso(weekStart),
    iso(weekEnd),
  );

  const byDate = new Map(rows.map((r) => [r.date, r]));
  const week: { date: string; distanceKm: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(weekStart.getUTCDate() + i);
    const key = iso(d);
    const r = byDate.get(key);
    week.push({
      date: key,
      distanceKm: r ? Number(r.distanceKm) : 0,
    });
  }

  const todayKey = iso(today);
  const todayRow = byDate.get(todayKey);
  const todayTotals = {
    date: todayKey,
    distanceKm: todayRow ? Number(todayRow.distanceKm) : 0,
    steps: todayRow?.steps ?? 0,
    activeMinutes: todayRow?.activeMinutes ?? 0,
  };

  const todayIdx = diffToMon; // 0-indexed position of today in the week array

  return Response.json({
    today: todayTotals,
    week,
    todayIdx,
    weekStart: iso(weekStart),
    weekEnd: iso(weekEnd),
  });
}
