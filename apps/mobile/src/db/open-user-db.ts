import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as SQLite from 'expo-sqlite';
import { getDbKey, randomKeyHex, setDbKey } from '../session/secure';
import { migrations } from './migrations/migrations';
import * as schema from './schema';

export type UserDb = ExpoSQLiteDatabase<typeof schema>;

/** La build no incluye SQLCipher: abrir la base la dejaría SIN cifrar, así que no se abre. */
export class SqlCipherUnavailableError extends Error {
  constructor() {
    super('SQLCipher no está disponible en esta build: la base quedaría sin cifrar');
    this.name = 'SqlCipherUnavailableError';
  }
}

export const dbFileName = (userId: string) => `saveria-${userId}.db`;

/** Lo que `openUserDb` necesita del exterior. Se puede reemplazar en pruebas. */
export interface OpenDbDeps {
  openDatabaseSync(name: string): SQLite.SQLiteDatabase;
  deleteDatabaseSync(name: string): void;
  getDbKey(userId: string): Promise<string | null>;
  setDbKey(userId: string, hexKey: string): Promise<void>;
  randomKeyHex(): string;
  drizzle(conn: SQLite.SQLiteDatabase): UserDb;
  migrate(db: UserDb): Promise<void>;
}

const defaultDeps: OpenDbDeps = {
  openDatabaseSync: (name) => SQLite.openDatabaseSync(name, { useNewConnection: true }),
  deleteDatabaseSync: (name) => SQLite.deleteDatabaseSync(name),
  getDbKey,
  setDbKey,
  randomKeyHex,
  drizzle: (conn) => drizzle(conn, { schema }),
  migrate: (db) => migrate(db, migrations),
};

const KEY_FORMAT = /^[0-9a-f]{64}$/;
const NOT_A_DATABASE = /file is not a database|SQLITE_NOTADB|code 26/i;

interface OpenDb {
  userId: string;
  db: UserDb;
  conn: SQLite.SQLiteDatabase;
}
let current: OpenDb | null = null;

/** Abre una conexión, activa el cifrado y comprueba que la clave sirve. */
function openKeyed(name: string, hexKey: string, deps: OpenDbDeps) {
  // La clave se interpola en un PRAGMA: debe ser exactamente 64 dígitos hexadecimales.
  if (!KEY_FORMAT.test(hexKey)) throw new Error('Clave de la base local con formato inválido');

  const conn = deps.openDatabaseSync(name);
  try {
    const cipher = conn.getFirstSync<{ cipher_version: string }>('PRAGMA cipher_version');
    if (cipher == null) throw new SqlCipherUnavailableError();
    conn.execSync(`PRAGMA key = "x'${hexKey}'"`);
    // Con una clave equivocada esta consulta falla con "file is not a database".
    conn.getFirstSync('SELECT count(*) AS n FROM sqlite_master');
    return conn;
  } catch (error) {
    conn.closeSync();
    throw error;
  }
}

/**
 * Abre la base cifrada del usuario (un archivo por usuario) y aplica las migraciones.
 *
 * Orden obligatorio, validado en spikes/sqlcipher-drizzle: abrir → comprobar `cipher_version` →
 * `PRAGMA key` → `drizzle(conexión)` → migraciones.
 *
 * Si la base no se puede leer con su clave (por ejemplo, el archivo se restauró sin la clave del
 * Keystore), se descarta y se crea una nueva: lo ya sincronizado se vuelve a descargar del
 * servidor y solo se pierde lo que no se había enviado.
 */
export async function openUserDb(userId: string, deps: OpenDbDeps = defaultDeps): Promise<UserDb> {
  if (current?.userId === userId) return current.db;
  closeUserDb();

  const name = dbFileName(userId);
  let hexKey = await deps.getDbKey(userId);
  if (hexKey === null) {
    hexKey = deps.randomKeyHex();
    await deps.setDbKey(userId, hexKey);
  }

  let conn: SQLite.SQLiteDatabase;
  try {
    conn = openKeyed(name, hexKey, deps);
  } catch (error) {
    // También cubre una clave recién creada frente a un archivo viejo: no hay forma de abrirlo.
    const unreadable = error instanceof Error && NOT_A_DATABASE.test(error.message);
    if (!unreadable) throw error;

    deps.deleteDatabaseSync(name);
    hexKey = deps.randomKeyHex();
    await deps.setDbKey(userId, hexKey);
    conn = openKeyed(name, hexKey, deps);
  }

  try {
    const db = deps.drizzle(conn);
    await deps.migrate(db);
    current = { userId, db, conn };
    return db;
  } catch (error) {
    conn.closeSync();
    throw error;
  }
}

/** Cierra la base abierta, si hay una. No borra el archivo ni la clave (FR-010). */
export function closeUserDb(): void {
  if (!current) return;
  try {
    current.conn.closeSync();
  } finally {
    current = null;
  }
}

export function getOpenUserDb(): { userId: string; db: UserDb } | null {
  return current ? { userId: current.userId, db: current.db } : null;
}
