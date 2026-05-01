import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://deztech:dev_password_change_me@localhost:5432/deztech_crm';

// Singleton pool на всё приложение
const globalForPool = globalThis as unknown as {
  pool?: Pool;
};

export const pool =
  globalForPool.pool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPool.pool = pool;
}

export const db = drizzle(pool, { schema });

export type DB = typeof db;
export * from './schema';
