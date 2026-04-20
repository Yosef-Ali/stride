import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import * as path from 'node:path';

// Load the monorepo-root .env (drizzle-kit runs from packages/db/).
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL_UNPOOLED (or DATABASE_URL) must be set in /.env for drizzle-kit.',
  );
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
