import 'dotenv/config';
import dotenv from 'dotenv';
import * as path from 'node:path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL required');

  const client = new Client({ connectionString: url });
  await client.connect();
  const db = drizzle(client);

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, '../drizzle'),
  });
  console.log('migrations applied');
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
