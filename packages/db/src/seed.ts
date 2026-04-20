import 'dotenv/config';
import dotenv from 'dotenv';
import * as path from 'node:path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import * as schema from './schema';
import * as queries from './queries';

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL required');

  const client = new Client({ connectionString: url });
  await client.connect();
  const db = drizzle(client, { schema });

  const email = 'dev.yosefali@gmail.com';

  // 1. User
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));
  const user =
    existing[0] ??
    (
      await db
        .insert(schema.users)
        .values({
          email,
          name: 'Yosef',
          avatarColor: '#1D9E75',
          weeklyGoalKm: '40',
        })
        .returning()
    )[0];

  console.log('user:', user.id, user.name);

  // 2. Family circle (idempotent on name+creator)
  const circleExisting = await db
    .select()
    .from(schema.circles)
    .where(
      and(eq(schema.circles.name, 'Family'), eq(schema.circles.createdBy, user.id)),
    );
  const circle =
    circleExisting[0] ??
    (
      await db
        .insert(schema.circles)
        .values({
          name: 'Family',
          inviteCode: generateInviteCode(),
          createdBy: user.id,
        })
        .returning()
    )[0];

  console.log('circle:', circle.id, circle.name, 'invite:', circle.inviteCode);

  // 3. Membership
  await db
    .insert(schema.circleMembers)
    .values({ circleId: circle.id, userId: user.id })
    .onConflictDoNothing();

  // 4. 90 days of sample walks so Home/Stats have history
  const today = new Date();

  // Deterministic PRNG so reseeding keeps the same shape.
  function mulberry32(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateHistory(userId: string, seed: number, baseKm: number) {
    const rand = mulberry32(seed);
    return Array.from({ length: 90 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;

      // Rest day roughly every 10 days
      const rest = rand() < 0.12;
      const weekendBoost = isWeekend ? 1.25 : 1.0;
      const jitter = 0.55 + rand() * 0.9; // 0.55-1.45
      const km = rest ? 0 : baseKm * weekendBoost * jitter;

      return {
        userId,
        date: d.toISOString().slice(0, 10),
        distanceKm: km.toFixed(2),
        steps: Math.round(km * 1350),
        activeMinutes: Math.round(km * 11),
      };
    });
  }

  const values = generateHistory(user.id, 42, 6.2);

  for (const v of values) {
    await db
      .insert(schema.dailyWalks)
      .values(v)
      .onConflictDoUpdate({
        target: [schema.dailyWalks.userId, schema.dailyWalks.date],
        set: {
          distanceKm: v.distanceKm,
          steps: v.steps,
          activeMinutes: v.activeMinutes,
        },
      });
  }

  console.log(`seeded ${values.length} daily_walks for ${user.name}`);

  // 5. Additional circle members so the leaderboard has real competition
  const extras = [
    {
      email: 'sara@stride.dev',
      name: 'Sara',
      avatarColor: '#C49A6C',
      weeklyPattern: [6.2, 7.1, 5.4, 8.0, 4.3, 7.2, 9.4], // ~47.6 km
    },
    {
      email: 'dawit@stride.dev',
      name: 'Dawit',
      avatarColor: '#6E8FAE',
      weeklyPattern: [3.1, 4.2, 5.0, 3.8, 4.5, 6.1, 4.9], // ~31.6 km
    },
    {
      email: 'hana@stride.dev',
      name: 'Hana',
      avatarColor: '#8C7B9B',
      weeklyPattern: [8.1, 6.5, 7.4, 9.2, 6.8, 8.3, 7.5], // ~53.8 km (should edge out Yosef)
    },
  ];

  for (const e of extras) {
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, e.email));
    const u =
      existing[0] ??
      (
        await db
          .insert(schema.users)
          .values({
            email: e.email,
            name: e.name,
            avatarColor: e.avatarColor,
            weeklyGoalKm: '40',
          })
          .returning()
      )[0];

    await db
      .insert(schema.circleMembers)
      .values({ circleId: circle.id, userId: u.id })
      .onConflictDoNothing();

    const rows = e.weeklyPattern.map((km, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      return {
        userId: u.id,
        date: d.toISOString().slice(0, 10),
        distanceKm: km.toFixed(2),
        steps: Math.round(km * 1350),
        activeMinutes: Math.round(km * 11),
      };
    });
    for (const r of rows) {
      await db
        .insert(schema.dailyWalks)
        .values(r)
        .onConflictDoUpdate({
          target: [schema.dailyWalks.userId, schema.dailyWalks.date],
          set: {
            distanceKm: r.distanceKm,
            steps: r.steps,
            activeMinutes: r.activeMinutes,
          },
        });
    }
    console.log(`seeded ${e.name}: ${rows.length} walks, member of ${circle.name}`);
  }

  // 6. Crown last week's winner so the Circle tab has a champion to render.
  // Cast: seed uses node-postgres driver; crownWeeklyWinners is typed against
  // the neon-http `Db`. Runtime query surface is identical for our usage.
  const crown = await queries.crownWeeklyWinners(db as unknown as Parameters<typeof queries.crownWeeklyWinners>[0]);
  console.log(
    `crowned ${crown.results.length} winner(s) for week ${crown.year}-W${crown.week} (${crown.from}..${crown.to})`,
  );

  await client.end();
}

function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
