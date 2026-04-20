import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  date,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarColor: text('avatar_color').notNull().default('#1D9E75'),
  weeklyGoalKm: numeric('weekly_goal_km', { precision: 6, scale: 2 })
    .notNull()
    .default('40'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const circles = pgTable(
  'circles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    inviteCode: text('invite_code').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    inviteCodeUnique: uniqueIndex('circles_invite_code_unique').on(t.inviteCode),
  }),
);

export const circleMembers = pgTable(
  'circle_members',
  {
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.circleId, t.userId] }),
    byUser: index('circle_members_by_user').on(t.userId),
  }),
);

export const dailyWalks = pgTable(
  'daily_walks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    distanceKm: numeric('distance_km', { precision: 7, scale: 3 })
      .notNull()
      .default('0'),
    steps: integer('steps').notNull().default(0),
    activeMinutes: integer('active_minutes').notNull().default(0),
  },
  (t) => ({
    userDateUnique: uniqueIndex('daily_walks_user_date_unique').on(
      t.userId,
      t.date,
    ),
    byUser: index('daily_walks_by_user').on(t.userId),
  }),
);

export const weeklyWins = pgTable(
  'weekly_wins',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weekNumber: integer('week_number').notNull(),
    year: integer('year').notNull(),
    distanceKm: numeric('distance_km', { precision: 7, scale: 3 }).notNull(),
    awardedAt: timestamp('awarded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    circleWeekUnique: uniqueIndex('weekly_wins_circle_year_week_unique').on(
      t.circleId,
      t.year,
      t.weekNumber,
    ),
    byUser: index('weekly_wins_by_user').on(t.userId),
  }),
);

/**
 * Email OTP codes. Short-lived (10 min), hashed (sha256), at most a handful
 * active per email. `consumedAt` marks single-use; `attempts` caps brute force.
 */
export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byEmail: index('otp_codes_by_email').on(t.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Circle = typeof circles.$inferSelect;
export type NewCircle = typeof circles.$inferInsert;
export type CircleMember = typeof circleMembers.$inferSelect;
export type DailyWalk = typeof dailyWalks.$inferSelect;
export type NewDailyWalk = typeof dailyWalks.$inferInsert;
export type WeeklyWin = typeof weeklyWins.$inferSelect;
