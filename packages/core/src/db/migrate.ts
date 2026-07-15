import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { backfillTenantConfigs } from './backfill.js';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../../.env') });

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://capstone@localhost:5432/red_tape_engine';

async function main() {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: './drizzle' });
  await backfillTenantConfigs();
  await client.end();
  console.log('Migrations complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});