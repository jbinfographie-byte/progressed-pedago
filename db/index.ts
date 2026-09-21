import { sql, type SQLWrapper } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

type AppDatabase = NodePgDatabase<typeof schema> & {
  batch: (queries: readonly SQLWrapper[]) => Promise<unknown[]>;
};

const globalDatabase = globalThis as typeof globalThis & {
  progressedPedagoPool?: Pool;
  progressedPedagoDb?: AppDatabase;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL est obligatoire pour utiliser PostgreSQL sur Hostinger.');
  const local = /(?:localhost|127\.0\.0\.1)/.test(connectionString);
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE || 10),
    ssl: local ? false : { rejectUnauthorized: false },
  });
}

export function getDb(): AppDatabase {
  if (globalDatabase.progressedPedagoDb) return globalDatabase.progressedPedagoDb;
  const pool = globalDatabase.progressedPedagoPool ?? createPool();
  globalDatabase.progressedPedagoPool = pool;
  const database = drizzle(pool, { schema }) as unknown as AppDatabase;
  database.batch = async (queries) => database.transaction(async (transaction) => {
    const results: unknown[] = [];
    for (const query of queries) results.push(await transaction.execute(query.getSQL()));
    return results;
  });
  globalDatabase.progressedPedagoDb = database;
  return database;
}

export async function checkDatabaseConnection() {
  await getDb().execute(sql`select 1`);
}
