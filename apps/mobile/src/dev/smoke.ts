/**
 * Chequeo de humo SOLO para desarrollo: ejercita en el dispositivo lo que Jest no puede (SQLCipher
 * y SQLite reales). Se activa arrancando Metro con EXPO_PUBLIC_SMOKE=1 y escribe líneas [SMOKE]
 * en el log. No forma parte del flujo normal de la app.
 */
import { File, FileMode, Paths } from 'expo-file-system';
import type * as SQLite from 'expo-sqlite';
import { closeUserDb, dbFileName, openUserDb, type UserDb } from '../db/open-user-db';
import { purgeUserData } from '../db/purge';
import { createOutbox, DrizzleOutboxStore, type Sender } from '../outbox/outbox';
import { getDbKey } from '../session/secure';

const USER = 'smoke-user';

function fileHeader(name: string): string {
  const handle = new File(Paths.document, 'SQLite', name).open(FileMode.ReadOnly);
  const bytes = handle.readBytesSync(16);
  handle.close();
  return String.fromCharCode(...bytes);
}

function fileExists(name: string): boolean {
  return new File(Paths.document, 'SQLite', name).exists;
}

export async function runSmoke(): Promise<void> {
  const results: { ok: boolean; name: string; detail: string }[] = [];
  const check = async (name: string, fn: () => unknown | Promise<unknown>) => {
    try {
      results.push({ ok: true, name, detail: String((await fn()) ?? '') });
    } catch (error) {
      results.push({
        ok: false,
        name,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };

  await purgeUserData(USER);
  let db!: UserDb;

  await check('1. abre la base cifrada del usuario y aplica las migraciones', async () => {
    db = await openUserDb(USER);
    const client = (db as unknown as { $client: SQLite.SQLiteDatabase }).$client;
    const cipher = client.getFirstSync<{ cipher_version: string }>('PRAGMA cipher_version');
    return `cipher_version=${cipher?.cipher_version}`;
  });

  await check('2. outbox: respeta el orden, reintenta con backoff y vacía la cola', async () => {
    let now = 1_000_000;
    let failFirst = true;
    const seen: string[] = [];
    const send: Sender = async (item) => {
      seen.push(item.entityId);
      if (failFirst) return { status: 'retry', error: 'sin red' };
      return { status: 'sent' };
    };
    const outbox = createOutbox(new DrizzleOutboxStore(db), send, { now: () => now });
    outbox.enqueue({
      entity: 'profile',
      entityId: 'a',
      operation: 'upsert',
      payload: { city: 'X' },
    });
    now += 1;
    outbox.enqueue({ entity: 'profile', entityId: 'b', operation: 'upsert', payload: {} });
    if (outbox.count() !== 2) throw new Error(`esperaba 2, hay ${outbox.count()}`);

    const first = await outbox.flush();
    if (first.stoppedBy !== 'retry' || first.remaining !== 2)
      throw new Error('el fallo no detuvo la cola');
    failFirst = false;
    const waiting = await outbox.flush();
    if (waiting.stoppedBy !== 'waiting') throw new Error('no respetó el backoff');
    now += 2_000;
    const done = await outbox.flush();
    if (done.sent !== 2 || done.remaining !== 0)
      throw new Error(`resumen inesperado: ${JSON.stringify(done)}`);
    return `orden=${seen.join(',')}`;
  });

  await check('3. los cambios pendientes sobreviven a cerrar y reabrir la base', async () => {
    const outbox = createOutbox(new DrizzleOutboxStore(db), async () => ({ status: 'sent' }));
    outbox.enqueue({
      entity: 'profile',
      entityId: 'c',
      operation: 'upsert',
      payload: { aiMode: 'auto' },
    });
    closeUserDb();
    db = await openUserDb(USER);
    const count = new DrizzleOutboxStore(db).count();
    if (count !== 1) throw new Error(`esperaba 1 cambio pendiente, hay ${count}`);
    return 'count=1';
  });

  await check('4. el archivo está cifrado en disco', () => {
    closeUserDb();
    const header = fileHeader(dbFileName(USER));
    if (header.startsWith('SQLite format 3')) throw new Error('el archivo está en texto plano');
    return 'cabecera ilegible';
  });

  await check('5. purgeUserData borra el archivo y la clave', async () => {
    await purgeUserData(USER);
    if (fileExists(dbFileName(USER))) throw new Error('el archivo sigue existiendo');
    if ((await getDbKey(USER)) !== null) throw new Error('la clave sigue guardada');
    return 'archivo y clave borrados';
  });

  for (const r of results) {
    console.log(`[SMOKE] ${r.ok ? 'PASS' : 'FAIL'} ${r.name} :: ${r.detail}`);
  }
  console.log(`[SMOKE] RESUMEN ${results.filter((r) => r.ok).length}/${results.length}`);
}
