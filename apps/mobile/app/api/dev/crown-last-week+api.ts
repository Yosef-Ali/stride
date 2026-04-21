/**
 * Dev-only: trigger weekly winner calculation without the CRON_SECRET.
 * Lets the Me tab offer a "Crown last week" button for manual testing.
 * Remove before shipping — same logic is protected under /api/cron/weekly-winner.
 */
import { queries } from '../../../src/server/db';
import { getDb } from '../../../src/server/context';

export async function POST() {
  const db = getDb();
  const summary = await queries.crownWeeklyWinners(db);
  return Response.json(summary);
}
