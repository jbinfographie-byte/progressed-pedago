import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { getDb } from '../db/index';

async function main() {
  await migrate(getDb(), { migrationsFolder: 'drizzle-postgres' });
  console.log('Migrations PostgreSQL terminées.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Échec des migrations PostgreSQL :', error instanceof Error ? error.message : error);
  process.exit(1);
});
