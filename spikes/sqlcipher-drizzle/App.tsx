// Spike 001: ¿Drizzle funciona sobre una base expo-sqlite cifrada con SQLCipher?
// Ejecuta las comprobaciones al abrir la app y muestra PASS/FAIL en pantalla y en logcat ([SPIKE]).
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import * as Crypto from 'expo-crypto';
import { File, FileMode, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const outbox = sqliteTable('outbox', {
  id: text('id').primaryKey(),
  entity: text('entity').notNull(),
  payload: text('payload').notNull(),
  attempts: integer('attempts').notNull().default(0),
});

// Migración empaquetada igual que las que genera drizzle-kit para Expo.
const migrations = {
  journal: {
    entries: [{ idx: 0, when: 1761100000000, tag: '0000_init', breakpoints: true }],
  },
  migrations: {
    m0000: `CREATE TABLE \`outbox\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`entity\` text NOT NULL,
  \`payload\` text NOT NULL,
  \`attempts\` integer DEFAULT 0 NOT NULL
);`,
  },
};

const ENC_DB = 'spike-encrypted.db';
const PLAIN_DB = 'spike-plain.db';

type Result = { name: string; ok: boolean; detail: string };

function openKeyed(name: string, key: string) {
  const conn = SQLite.openDatabaseSync(name, { useNewConnection: true });
  const cipher = conn.getFirstSync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (cipher == null) {
    conn.closeSync();
    throw new Error('SQLCipher no está en esta build: la base quedaría sin cifrar');
  }
  conn.execSync(`PRAGMA key = "x'${key}'"`);
  return { conn, cipherVersion: cipher.cipher_version };
}

async function header(name: string) {
  const handle = new File(Paths.document, 'SQLite', name).open(FileMode.ReadOnly);
  const bytes = handle.readBytesSync(16);
  handle.close();
  return String.fromCharCode(...bytes);
}

async function runSpike(): Promise<Result[]> {
  const results: Result[] = [];
  const check = async (name: string, fn: () => unknown | Promise<unknown>) => {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail: String(detail ?? '') });
    } catch (e) {
      results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  };

  for (const name of [ENC_DB, PLAIN_DB]) {
    try {
      SQLite.deleteDatabaseSync(name);
    } catch {}
  }

  const key = Crypto.getRandomBytes(32).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
  const wrongKey = 'ab'.repeat(32);

  // 1. Abrir, poner clave, migrar y escribir con Drizzle (incluida una transacción).
  await check('1. SQLCipher activo + migración + escritura con Drizzle', async () => {
    const { conn, cipherVersion } = openKeyed(ENC_DB, key);
    const db = drizzle(conn);
    await migrate(db, migrations);
    db.transaction((tx) => {
      tx.insert(outbox).values({ id: Crypto.randomUUID(), entity: 'profile', payload: '{"city":"Barranquilla"}' }).run();
      tx.insert(outbox).values({ id: Crypto.randomUUID(), entity: 'profile', payload: '{"aiMode":"auto"}' }).run();
    });
    const count = db.select({ n: sql<number>`count(*)` }).from(outbox).get();
    conn.closeSync();
    if (count?.n !== 2) throw new Error(`esperaba 2 filas, hay ${count?.n}`);
    return `cipher_version=${cipherVersion}, filas=2`;
  });

  // 2. La transacción hace rollback correctamente.
  await check('2. Rollback de transacción', () => {
    const { conn } = openKeyed(ENC_DB, key);
    const db = drizzle(conn);
    try {
      db.transaction((tx) => {
        tx.insert(outbox).values({ id: 'rollback-me', entity: 'profile', payload: '{}' }).run();
        tx.rollback();
      });
    } catch {}
    const row = db.select().from(outbox).where(eq(outbox.id, 'rollback-me')).get();
    conn.closeSync();
    if (row) throw new Error('la fila no debía existir');
    return 'ok';
  });

  // 3. El archivo en disco no es SQLite legible.
  await check('3. El archivo está cifrado (sin cabecera "SQLite format 3")', async () => {
    const h = await header(ENC_DB);
    if (h.startsWith('SQLite format 3')) throw new Error('el archivo está en texto plano');
    return 'cabecera ilegible';
  });

  // 4. Control: una base sin clave sí tiene la cabecera de SQLite (valida la comprobación 3).
  await check('4. Control: base sin clave sí es texto plano', async () => {
    const conn = SQLite.openDatabaseSync(PLAIN_DB, { useNewConnection: true });
    conn.execSync('CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1);');
    conn.closeSync();
    const h = await header(PLAIN_DB);
    if (!h.startsWith('SQLite format 3')) throw new Error(`cabecera inesperada: ${h}`);
    return 'cabecera "SQLite format 3"';
  });

  // 5. Con la clave equivocada no se puede leer.
  await check('5. Clave equivocada → no se puede leer', () => {
    const { conn } = openKeyed(ENC_DB, wrongKey);
    try {
      drizzle(conn).select().from(outbox).all();
    } catch (e) {
      return `rechazado: ${e instanceof Error ? e.message.slice(0, 80) : e}`;
    } finally {
      conn.closeSync();
    }
    throw new Error('¡leyó datos con una clave equivocada!');
  });

  // 6. Sin clave no se puede leer.
  await check('6. Sin clave → no se puede leer', () => {
    const conn = SQLite.openDatabaseSync(ENC_DB, { useNewConnection: true });
    try {
      conn.getAllSync('SELECT * FROM outbox');
    } catch (e) {
      return `rechazado: ${e instanceof Error ? e.message.slice(0, 80) : e}`;
    } finally {
      conn.closeSync();
    }
    throw new Error('¡leyó datos sin clave!');
  });

  // 7. Reabrir con la clave correcta conserva los datos (simula cerrar y abrir la app).
  await check('7. Reabrir con la clave correcta conserva los datos', () => {
    const { conn } = openKeyed(ENC_DB, key);
    const rows = drizzle(conn).select().from(outbox).all();
    conn.closeSync();
    if (rows.length !== 2) throw new Error(`esperaba 2 filas, hay ${rows.length}`);
    return `filas=${rows.length}, ej: ${rows[0].payload}`;
  });

  return results;
}

export default function App() {
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => {
    runSpike().then((r) => {
      r.forEach((x) => console.log(`[SPIKE] ${x.ok ? 'PASS' : 'FAIL'} ${x.name} :: ${x.detail}`));
      console.log(`[SPIKE] RESUMEN ${r.filter((x) => x.ok).length}/${r.length}`);
      setResults(r);
    });
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Spike SQLCipher + Drizzle</Text>
      {results == null && <Text>Ejecutando…</Text>}
      {results?.map((r) => (
        <Text key={r.name} style={{ color: r.ok ? '#0a7d32' : '#c0262d', marginBottom: 8 }}>
          {r.ok ? 'PASS' : 'FAIL'} — {r.name}
          {'\n'}
          {r.detail}
        </Text>
      ))}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
});
