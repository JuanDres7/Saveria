import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = ReturnType<typeof createDb>['db'];

export function createDb(url: string) {
  const client = postgres(url, { onnotice: () => {} });
  const db = drizzle(client, { schema });
  return { db, client };
}
