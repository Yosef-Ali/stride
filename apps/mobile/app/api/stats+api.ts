import { queries } from '../../src/server/db';
import {
  badRequest,
  getActorId,
  getDb,
  unauthorized,
} from '../../src/server/context';

type Range = '7d' | '30d' | '90d';
const DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90 };

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Build a full date list [from..to] so gaps in DB show as zero on the chart. */
function dateRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    out.push(iso(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function GET(req: Request) {
  const actorId = getActorId(req);
  if (!actorId) return unauthorized();

  const url = new URL(req.url);
  const range = (url.searchParams.get('range') ?? '7d') as Range;
  if (!DAYS[range]) return badRequest('invalid range');
  const days = DAYS[range];

  const today = new Date();
  const to = new Date(today);
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));

  // Previous equivalent window for delta comparison
  const prevTo = new Date(from);
  prevTo.setDate(from.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevTo.getDate() - (days - 1));

  const db = getDb();
  const [curr, prev] = await Promise.all([
    queries.getMyStats(db, actorId, iso(from), iso(to)),
    queries.getMyStats(db, actorId, iso(prevFrom), iso(prevTo)),
  ]);

  const byDate = new Map<string, { km: number; steps: number; min: number }>();
  for (const r of curr) {
    byDate.set(r.date, {
      km: Number(r.distanceKm),
      steps: r.steps,
      min: r.activeMinutes,
    });
  }
  const dailySeries = dateRange(from, to).map((d) => ({
    date: d,
    distanceKm: byDate.get(d)?.km ?? 0,
  }));

  const totalKm = curr.reduce((s, r) => s + Number(r.distanceKm), 0);
  const totalSteps = curr.reduce((s, r) => s + r.steps, 0);
  const totalActiveMin = curr.reduce((s, r) => s + r.activeMinutes, 0);
  const activeDays = curr.filter((r) => Number(r.distanceKm) > 0).length;
  const avgKmPerDay = totalKm / days;
  const avgPaceKmh =
    totalActiveMin > 0 ? totalKm / (totalActiveMin / 60) : 0;

  const prevTotalKm = prev.reduce((s, r) => s + Number(r.distanceKm), 0);
  const deltaPct =
    prevTotalKm > 0
      ? Math.round(((totalKm - prevTotalKm) / prevTotalKm) * 100)
      : null;

  // Personal records within the range
  let bestDay: { date: string; distanceKm: number } | null = null;
  for (const d of dailySeries) {
    if (!bestDay || d.distanceKm > bestDay.distanceKm) bestDay = d;
  }

  // Rolling 7-day best within the range
  let bestWeek: { startDate: string; distanceKm: number } | null = null;
  for (let i = 0; i + 7 <= dailySeries.length; i++) {
    const sum = dailySeries
      .slice(i, i + 7)
      .reduce((s, d) => s + d.distanceKm, 0);
    if (!bestWeek || sum > bestWeek.distanceKm) {
      bestWeek = { startDate: dailySeries[i]!.date, distanceKm: sum };
    }
  }

  return Response.json({
    range,
    from: iso(from),
    to: iso(to),
    totalKm: Number(totalKm.toFixed(2)),
    totalSteps,
    totalActiveMin,
    activeDays,
    avgKmPerDay: Number(avgKmPerDay.toFixed(2)),
    avgPaceKmh: Number(avgPaceKmh.toFixed(2)),
    deltaPct,
    dailySeries,
    bestDay: bestDay
      ? { ...bestDay, distanceKm: Number(bestDay.distanceKm.toFixed(2)) }
      : null,
    bestWeek: bestWeek
      ? {
          ...bestWeek,
          distanceKm: Number(bestWeek.distanceKm.toFixed(2)),
        }
      : null,
  });
}
