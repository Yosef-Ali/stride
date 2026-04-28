import { queries } from '../../src/server/db';
import { getActorId, getDb, unauthorized } from '../../src/server/context';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Home screen payload: today's totals + the Mon→Sun bars for the current week.
 * Zero-fills gaps so the UI can always render 7 bars.
 *
 * The week is anchored to the *client's local calendar day*, passed as
 * `?today=YYYY-MM-DD`. Walks are written under the device's local date, so
 * computing the week in UTC on the server would put a Monday-evening walk
 * (UTC+3) into the previous week's Sunday bucket on a server-UTC clock.
 * Falling back to UTC `today` only when the param is missing keeps old
 * clients working.
 */
export async function GET(req: Request) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();

  const url = new URL(req.url);
  const todayParam = url.searchParams.get('today') ?? '';
  const todayKey = DATE_RE.test(todayParam)
    ? todayParam
    : new Date().toISOString().slice(0, 10);

  // Build the week using string arithmetic against todayKey to avoid any
  // timezone re-interpretation. Anchor on UTC noon so the Date object can't
  // drift into the previous/next day under daylight-savings.
  const [yy, mm, dd] = todayKey.split('-').map(Number);
  const today = new Date(Date.UTC(yy, mm - 1, dd, 12));
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
  const week: {
    date: string;
    distanceKm: number;
    steps: number;
    activeMinutes: number;
  }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(weekStart.getUTCDate() + i);
    const key = iso(d);
    const r = byDate.get(key);
    week.push({
      date: key,
      distanceKm: r ? Number(r.distanceKm) : 0,
      steps: r?.steps ?? 0,
      activeMinutes: r?.activeMinutes ?? 0,
    });
  }

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
