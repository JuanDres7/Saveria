/**
 * Pruebas de las consultas de la base local contra un SQLite real (el de Bun). Jest corre con una
 * base simulada y no puede comprobar sumas ni migraciones; estas pruebas sí. Corren con
 * `bun run --cwd apps/mobile test:sqlite`.
 */
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrations } from '../src/db/migrations/migrations';
import type { UserDb } from '../src/db/open-user-db';
import * as schema from '../src/db/schema';

type MigrationKey = keyof typeof migrations.migrations;

/** Aplica las migraciones empaquetadas de la app, en orden, de `from` a `upTo` (incluidas). */
export function applyMigrations(
  sqlite: Database,
  { from = 0, upTo = migrations.journal.entries.length - 1 } = {},
) {
  for (const entry of migrations.journal.entries.slice(from, upTo + 1)) {
    const key = `m${String(entry.idx).padStart(4, '0')}` as MigrationKey;
    for (const statement of migrations.migrations[key].split('--> statement-breakpoint')) {
      if (statement.trim()) sqlite.run(statement);
    }
  }
}

/** Una base local nueva, migrada, con la misma API que usa la app. */
export function createLocalDb(): { sqlite: Database; db: UserDb } {
  const sqlite = new Database(':memory:');
  applyMigrations(sqlite);
  // Los dos drivers de Drizzle exponen la misma API síncrona sobre el mismo esquema.
  const db = drizzle(sqlite, { schema }) as unknown as UserDb;
  return { sqlite, db };
}
