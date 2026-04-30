/**
 * Scoped query helpers. Every read takes an `actorId` (the authenticated user)
 * and refuses to return rows outside that user's circles. This is our
 * RLS-equivalent: since Neon has no Supabase-auth to drive Postgres RLS, we
 * enforce the same invariants at the query layer. Callers MUST go through
 * these helpers — do not hand-write queries against `daily_walks` etc. in app
 * code.
 */

import { and, desc, eq, exists, gt, inArray, isNull, sql } from 'drizzle-orm';
import { createHash, randomInt } from 'node:crypto';
import type { Db } from './client';
import {
  circles,
  circleMembers,
  dailyWalks,
  otpCodes,
  users,
  weeklyWins,
} from './schema';

// ─── Auth / OTP ────────────────────────────────────────────────────────────

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_ACTIVE_PER_EMAIL = 3;

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Generate and store a fresh 6-digit OTP for the given email. Returns the
 * plaintext code so the caller can email it (and, in dev, echo it back for
 * testing). Rate-limited to 3 active codes per email.
 */
export async function requestOtp(
  db: Db,
  rawEmail: string,
): Promise<{ code: string } | { rateLimited: true }> {
  const email = normalizeEmail(rawEmail);
  const now = new Date();

  // Count still-valid codes
  const active = await db
    .select({ id: otpCodes.id })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, email),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, now),
      ),
    );
  if (active.length >= OTP_MAX_ACTIVE_PER_EMAIL) {
    return { rateLimited: true };
  }

  // 6-digit zero-padded
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await db.insert(otpCodes).values({
    email,
    codeHash: sha256(code),
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
  });
  return { code };
}

/**
 * Verify a submitted code. On success: marks it consumed, upserts the user,
 * returns the user row. Each active code gets at most 5 attempts; exceeding
 * that burns the code.
 */
export async function verifyOtp(
  db: Db,
  rawEmail: string,
  code: string,
): Promise<
  | { ok: true; user: { id: string; name: string; email: string } }
  | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' }
> {
  const email = normalizeEmail(rawEmail);
  const now = new Date();

  const rows = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, email),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, now),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return { ok: false, reason: 'expired' };

  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: 'too_many_attempts' };
  }

  if (row.codeHash !== sha256(code)) {
    await db
      .update(otpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(otpCodes.id, row.id));
    return { ok: false, reason: 'invalid' };
  }

  await db
    .update(otpCodes)
    .set({ consumedAt: now })
    .where(eq(otpCodes.id, row.id));

  // Upsert the user (first-time login creates the account).
  const existing = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  const user =
    existing ??
    (
      await db
        .insert(users)
        .values({
          email,
          name: email.split('@')[0]!.slice(0, 40),
        })
        .returning()
    )[0]!;

  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email },
  };
}

export async function getUser(db: Db, userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId));
  return rows[0] ?? null;
}

/** All circles the actor belongs to. */
export async function getMyCircles(db: Db, actorId: string) {
  return db
    .select({
      id: circles.id,
      name: circles.name,
      inviteCode: circles.inviteCode,
      createdBy: circles.createdBy,
      createdAt: circles.createdAt,
    })
    .from(circles)
    .innerJoin(circleMembers, eq(circleMembers.circleId, circles.id))
    .where(eq(circleMembers.userId, actorId));
}

/** Members of a circle — only readable if actor is a member. */
export async function getCircleMembers(
  db: Db,
  actorId: string,
  circleId: string,
) {
  const membership = await assertCircleMember(db, actorId, circleId);
  if (!membership) return null;

  return db
    .select({
      userId: users.id,
      name: users.name,
      avatarColor: users.avatarColor,
      joinedAt: circleMembers.joinedAt,
    })
    .from(circleMembers)
    .innerJoin(users, eq(users.id, circleMembers.userId))
    .where(eq(circleMembers.circleId, circleId));
}

/** Recent walks for a user — only if actor shares a circle with them (or is them). */
export async function getWalksForUser(
  db: Db,
  actorId: string,
  targetUserId: string,
  limit = 30,
) {
  if (!(await sharesCircle(db, actorId, targetUserId))) return null;

  return db
    .select()
    .from(dailyWalks)
    .where(eq(dailyWalks.userId, targetUserId))
    .orderBy(desc(dailyWalks.date))
    .limit(limit);
}

/** Leaderboard for a circle over a date range. Circle-scoped. */
export async function getCircleLeaderboard(
  db: Db,
  actorId: string,
  circleId: string,
  from: string,
  to: string,
) {
  const membership = await assertCircleMember(db, actorId, circleId);
  if (!membership) return null;

  const memberIds = db
    .select({ userId: circleMembers.userId })
    .from(circleMembers)
    .where(eq(circleMembers.circleId, circleId));

  return db
    .select({
      userId: users.id,
      name: users.name,
      avatarColor: users.avatarColor,
      distanceKm: sql<string>`coalesce(sum(${dailyWalks.distanceKm}), 0)`.as(
        'distance_km',
      ),
      activeMinutes: sql<number>`coalesce(sum(${dailyWalks.activeMinutes}), 0)`.as(
        'active_minutes',
      ),
    })
    .from(users)
    .where(inArray(users.id, memberIds))
    .leftJoin(
      dailyWalks,
      and(
        eq(dailyWalks.userId, users.id),
        sql`${dailyWalks.date} between ${from} and ${to}`,
      ),
    )
    .groupBy(users.id, users.name, users.avatarColor)
    .orderBy(
      desc(sql`coalesce(sum(${dailyWalks.distanceKm}), 0)`),
    );
}

/** Trophy shelf for a user — only if actor shares a circle (or is them). */
export async function getWinsForUser(
  db: Db,
  actorId: string,
  targetUserId: string,
) {
  if (!(await sharesCircle(db, actorId, targetUserId))) return null;

  return db
    .select()
    .from(weeklyWins)
    .where(eq(weeklyWins.userId, targetUserId))
    .orderBy(desc(weeklyWins.year), desc(weeklyWins.weekNumber));
}

/**
 * Range summary for the actor: totals + per-day series over [from, to].
 * Self-only — actor reads their own history.
 */
export async function getMyStats(
  db: Db,
  actorId: string,
  from: string,
  to: string,
) {
  const rows = await db
    .select({
      date: dailyWalks.date,
      distanceKm: dailyWalks.distanceKm,
      steps: dailyWalks.steps,
      activeMinutes: dailyWalks.activeMinutes,
    })
    .from(dailyWalks)
    .where(
      and(
        eq(dailyWalks.userId, actorId),
        sql`${dailyWalks.date} between ${from} and ${to}`,
      ),
    )
    .orderBy(dailyWalks.date);
  return rows;
}

// ─── Writes ────────────────────────────────────────────────────────────────

const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
function generateInviteCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return out;
}

/** Create a new circle, insert actor as the first member. Returns the circle. */
export async function createCircle(
  db: Db,
  actorId: string,
  input: { name: string },
) {
  const name = input.name.trim();
  if (!name) throw new Error('circle name required');

  // Retry on unique-invite collision (astronomically unlikely, but cheap).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      const [circle] = await db
        .insert(circles)
        .values({ name, inviteCode: code, createdBy: actorId })
        .returning();

      await db
        .insert(circleMembers)
        .values({ circleId: circle!.id, userId: actorId })
        .onConflictDoNothing();

      return circle!;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('circles_invite_code_unique')) continue;
      throw e;
    }
  }
  throw new Error('failed to allocate invite code');
}

/** Join an existing circle by invite code. Idempotent on membership. */
export async function joinCircleByCode(
  db: Db,
  actorId: string,
  code: string,
) {
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== 8) throw new Error('invalid code');

  const [circle] = await db
    .select()
    .from(circles)
    .where(eq(circles.inviteCode, normalized))
    .limit(1);

  if (!circle) return null;

  const [existing] = await db
    .select({ userId: circleMembers.userId })
    .from(circleMembers)
    .where(
      and(
        eq(circleMembers.circleId, circle.id),
        eq(circleMembers.userId, actorId),
      ),
    )
    .limit(1);

  if (!existing) {
    const [{ count: memberCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(circleMembers)
      .where(eq(circleMembers.circleId, circle.id));

    if (memberCount >= 10) {
      return { full: true as const };
    }
  }

  await db
    .insert(circleMembers)
    .values({ circleId: circle.id, userId: actorId })
    .onConflictDoNothing();

  return circle;
}

/**
 * ISO week number (1-53) per ISO 8601 — matches "Mon = start of week".
 * Year returned is the ISO year, which for the first days of Jan can be
 * the previous calendar year.
 */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: d.getUTCFullYear(), week };
}

/**
 * For every circle, find last completed week's top walker and insert into
 * weekly_wins. Idempotent: unique(circle_id, year, week_number) means
 * re-running safely does nothing. Returns the winners written or already on
 * file for the target week.
 *
 * Intended to be called by a Monday 00:05 cron job, once per week per circle.
 */
export async function crownWeeklyWinners(
  db: Db,
  opts?: { referenceDate?: Date },
) {
  const ref = opts?.referenceDate ?? new Date();

  // Last week = the Mon–Sun before the reference date's week.
  const day = ref.getDay();
  const diffToThisMon = (day + 6) % 7;
  const thisMon = new Date(ref);
  thisMon.setDate(ref.getDate() - diffToThisMon);
  thisMon.setHours(0, 0, 0, 0);
  const lastMon = new Date(thisMon);
  lastMon.setDate(thisMon.getDate() - 7);
  const lastSun = new Date(thisMon);
  lastSun.setDate(thisMon.getDate() - 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const from = iso(lastMon);
  const to = iso(lastSun);
  const { year, week } = isoWeek(lastMon);

  // All circles. (This is a cron task, not user-scoped.)
  const allCircles = await db.select({ id: circles.id }).from(circles);
  const results: {
    circleId: string;
    userId: string;
    distanceKm: string;
    year: number;
    week: number;
    inserted: boolean;
  }[] = [];

  for (const c of allCircles) {
    // Sum last week's distance per member.
    const members = db
      .select({ userId: circleMembers.userId })
      .from(circleMembers)
      .where(eq(circleMembers.circleId, c.id));

    const rows = await db
      .select({
        userId: dailyWalks.userId,
        distanceKm:
          sql<string>`coalesce(sum(${dailyWalks.distanceKm}), 0)`.as(
            'distance_km',
          ),
      })
      .from(dailyWalks)
      .where(
        and(
          inArray(dailyWalks.userId, members),
          sql`${dailyWalks.date} between ${from} and ${to}`,
        ),
      )
      .groupBy(dailyWalks.userId)
      .orderBy(desc(sql`coalesce(sum(${dailyWalks.distanceKm}), 0)`))
      .limit(1);

    const top = rows[0];
    if (!top || Number(top.distanceKm) <= 0) continue;

    try {
      await db.insert(weeklyWins).values({
        circleId: c.id,
        userId: top.userId,
        weekNumber: week,
        year,
        distanceKm: String(top.distanceKm),
      });
      results.push({
        circleId: c.id,
        userId: top.userId,
        distanceKm: String(top.distanceKm),
        year,
        week,
        inserted: true,
      });
    } catch (e: any) {
      // Unique violation = already crowned. Fine.
      if (String(e?.message ?? e).includes('weekly_wins_circle_year_week')) {
        results.push({
          circleId: c.id,
          userId: top.userId,
          distanceKm: String(top.distanceKm),
          year,
          week,
          inserted: false,
        });
        continue;
      }
      throw e;
    }
  }
  return { year, week, from, to, results };
}

/** Recent winners for a circle. Actor must be a member. */
export async function getCircleWinners(
  db: Db,
  actorId: string,
  circleId: string,
  limit = 4,
) {
  const membership = await assertCircleMember(db, actorId, circleId);
  if (!membership) return null;

  return db
    .select({
      id: weeklyWins.id,
      userId: weeklyWins.userId,
      name: users.name,
      avatarColor: users.avatarColor,
      weekNumber: weeklyWins.weekNumber,
      year: weeklyWins.year,
      distanceKm: weeklyWins.distanceKm,
      awardedAt: weeklyWins.awardedAt,
    })
    .from(weeklyWins)
    .innerJoin(users, eq(users.id, weeklyWins.userId))
    .where(eq(weeklyWins.circleId, circleId))
    .orderBy(desc(weeklyWins.year), desc(weeklyWins.weekNumber))
    .limit(limit);
}

/** Upsert today's walk totals from a Health Connect read. Self-only. */
export async function upsertOwnWalk(
  db: Db,
  actorId: string,
  row: {
    date: string;
    distanceKm: string;
    steps: number;
    activeMinutes: number;
  },
) {
  await db
    .insert(dailyWalks)
    .values({ userId: actorId, ...row })
    .onConflictDoUpdate({
      target: [dailyWalks.userId, dailyWalks.date],
      set: {
        distanceKm: row.distanceKm,
        steps: row.steps,
        activeMinutes: row.activeMinutes,
      },
    });
}

/** Update the actor's own profile. Returns the fresh row. */
export async function updateMyProfile(
  db: Db,
  actorId: string,
  patch: { name?: string; avatarColor?: string; weeklyGoalKm?: string },
) {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.avatarColor !== undefined) set.avatarColor = patch.avatarColor;
  if (patch.weeklyGoalKm !== undefined) set.weeklyGoalKm = patch.weeklyGoalKm;
  if (Object.keys(set).length === 0) {
    return (await db.select().from(users).where(eq(users.id, actorId)))[0] ??
      null;
  }
  const rows = await db
    .update(users)
    .set(set)
    .where(eq(users.id, actorId))
    .returning();
  return rows[0] ?? null;
}

/**
 * Leave a circle. Actor must be a member; owners cannot leave (would orphan
 * the circle). Idempotent: removing a missing membership is a no-op.
 * Returns { left: boolean, reason?: string }.
 */
export async function leaveCircle(
  db: Db,
  actorId: string,
  circleId: string,
): Promise<{ left: boolean; reason?: string }> {
  const circle = (
    await db
      .select({ createdBy: circles.createdBy })
      .from(circles)
      .where(eq(circles.id, circleId))
      .limit(1)
  )[0];
  if (!circle) return { left: false, reason: 'circle not found' };
  if (circle.createdBy === actorId) {
    return { left: false, reason: 'owner cannot leave' };
  }
  const deleted = await db
    .delete(circleMembers)
    .where(
      and(
        eq(circleMembers.circleId, circleId),
        eq(circleMembers.userId, actorId),
      ),
    )
    .returning({ id: circleMembers.userId });
  return { left: deleted.length > 0 };
}

// ─── Invariants ────────────────────────────────────────────────────────────

async function assertCircleMember(
  db: Db,
  actorId: string,
  circleId: string,
): Promise<boolean> {
  const rows = await db
    .select({ ok: sql<number>`1` })
    .from(circleMembers)
    .where(
      and(
        eq(circleMembers.circleId, circleId),
        eq(circleMembers.userId, actorId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function sharesCircle(
  db: Db,
  actorId: string,
  targetUserId: string,
): Promise<boolean> {
  if (actorId === targetUserId) return true;

  const rows = await db
    .select({ ok: sql<number>`1` })
    .from(circleMembers)
    .where(
      and(
        eq(circleMembers.userId, actorId),
        exists(
          db
            .select({ ok: sql<number>`1` })
            .from(circleMembers)
            .where(
              and(
                eq(
                  circleMembers.circleId,
                  sql.raw('circle_members.circle_id'),
                ),
                eq(circleMembers.userId, targetUserId),
              ),
            ),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
