import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../../.env') });

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://capstone@localhost:5432/red_tape_engine';

const client = postgres(connectionString, { max: 10 });
export const db = drizzle(client, { schema });
export { schema };