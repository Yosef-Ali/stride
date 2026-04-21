import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// In serverless / edge contexts we prefer fetch-based connections.
// `neonConfig.fetchConnectionCache = true` is the default on recent versions.
neonConfig.fetchConnectionCache = true;

export type DbEnv = { DATABASE_URL: string };

export function createDb(env: DbEnv) {
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;
export { schema };
