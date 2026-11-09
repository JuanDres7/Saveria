/**
 * Empaqueta las migraciones SQL que genera drizzle-kit como texto dentro de un módulo TypeScript.
 * Así Metro no necesita plugins para importar archivos .sql y el formato coincide con lo que
 * espera `migrate()` de drizzle-orm/expo-sqlite (probado en spikes/sqlcipher-drizzle).
 *
 * Uso: bun scripts/embed-migrations.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'db', 'migrations');
const journal = JSON.parse(readFileSync(join(dir, 'meta', '_journal.json'), 'utf-8'));

const migrations = {};
for (const entry of journal.entries) {
  const key = `m${String(entry.idx).padStart(4, '0')}`;
  migrations[key] = readFileSync(join(dir, `${entry.tag}.sql`), 'utf-8');
}

const output = `// Generado por scripts/embed-migrations.mjs. No editar a mano: ejecuta \`bun run db:generate\`.
export const migrations = {
  journal: ${JSON.stringify({ entries: journal.entries }, null, 2).replace(/\n/g, '\n  ')},
  migrations: ${JSON.stringify(migrations, null, 2).replace(/\n/g, '\n  ')},
};
`;

writeFileSync(join(dir, 'migrations.ts'), output, 'utf-8');
console.log(`Migraciones empaquetadas: ${journal.entries.length}`);
