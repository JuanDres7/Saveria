import type * as SQLite from 'expo-sqlite';
import {
  closeUserDb,
  dbFileName,
  getOpenUserDb,
  type OpenDbDeps,
  openUserDb,
  SqlCipherUnavailableError,
  type UserDb,
} from '../src/db/open-user-db';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

interface Scenario {
  /** La build incluye SQLCipher */
  cipher?: boolean;
  /** Por conexión abierta (en orden): ¿la clave abre el archivo? */
  keyWorks?: boolean[];
  /** Claves que ya guarda el Keystore */
  keys?: Record<string, string>;
  /** Claves que genera `randomKeyHex`, en orden */
  generated?: string[];
  migrateError?: Error;
  readError?: Error;
}

function setup(scenario: Scenario = {}) {
  const log: string[] = [];
  const keys = new Map(Object.entries(scenario.keys ?? {}));
  const generated = [...(scenario.generated ?? [KEY_A, KEY_B])];
  let opened = 0;

  const deps: OpenDbDeps = {
    openDatabaseSync(name) {
      const keyWorks = scenario.keyWorks?.[opened] ?? true;
      opened += 1;
      log.push(`open:${name}`);
      return {
        getFirstSync(sql: string) {
          log.push(`read:${sql}`);
          if (sql.includes('cipher_version')) {
            return scenario.cipher === false ? null : { cipher_version: '4.17.0 community' };
          }
          if (!keyWorks) throw new Error('Error code 26: file is not a database');
          if (scenario.readError) throw scenario.readError;
          return { n: 0 };
        },
        execSync(sql: string) {
          log.push(`exec:${sql}`);
        },
        closeSync() {
          log.push('close');
        },
      } as unknown as SQLite.SQLiteDatabase;
    },
    deleteDatabaseSync: (name) => void log.push(`delete:${name}`),
    getDbKey: async (id) => keys.get(id) ?? null,
    setDbKey: async (id, key) => {
      keys.set(id, key);
      log.push(`setKey:${id}:${key[0]}`);
    },
    randomKeyHex: () => generated.shift() ?? 'c'.repeat(64),
    drizzle: (conn) => {
      log.push('drizzle');
      return { conn } as unknown as UserDb;
    },
    migrate: async () => {
      log.push('migrate');
      if (scenario.migrateError) throw scenario.migrateError;
    },
  };
  return { deps, log, keys };
}

afterEach(() => closeUserDb());

describe('openUserDb', () => {
  it('sigue el orden validado: abrir → cipher_version → PRAGMA key → leer → drizzle → migrar', async () => {
    const { deps, log } = setup({ keys: { u1: KEY_A } });
    await openUserDb('u1', deps);
    expect(log).toEqual([
      'open:saveria-u1.db',
      'read:PRAGMA cipher_version',
      `exec:PRAGMA key = "x'${KEY_A}'"`,
      'read:SELECT count(*) AS n FROM sqlite_master',
      'drizzle',
      'migrate',
    ]);
  });

  it('usa un archivo distinto por usuario', () => {
    expect(dbFileName('u1')).toBe('saveria-u1.db');
    expect(dbFileName('u2')).not.toBe(dbFileName('u1'));
  });

  it('si la build no tiene SQLCipher NO abre la base (quedaría sin cifrar)', async () => {
    const { deps, log } = setup({ cipher: false, keys: { u1: KEY_A } });
    await expect(openUserDb('u1', deps)).rejects.toBeInstanceOf(SqlCipherUnavailableError);
    expect(log.some((l) => l.startsWith('exec:PRAGMA key'))).toBe(false);
    expect(log).not.toContain('drizzle');
    expect(log).not.toContain('migrate');
    expect(log).toContain('close');
    expect(getOpenUserDb()).toBeNull();
  });

  it('un usuario nuevo recibe una clave aleatoria que se guarda antes de abrir', async () => {
    const { deps, log, keys } = setup({ generated: [KEY_A] });
    await openUserDb('u1', deps);
    expect(keys.get('u1')).toBe(KEY_A);
    expect(log.indexOf('setKey:u1:a')).toBeLessThan(log.indexOf('open:saveria-u1.db'));
    expect(log).toContain(`exec:PRAGMA key = "x'${KEY_A}'"`);
  });

  it('un usuario con clave guardada la reutiliza y no genera otra', async () => {
    const { deps, log } = setup({ keys: { u1: KEY_A }, generated: [KEY_B] });
    await openUserDb('u1', deps);
    expect(log.some((l) => l.startsWith('setKey'))).toBe(false);
    expect(log).toContain(`exec:PRAGMA key = "x'${KEY_A}'"`);
  });

  it('con una clave que no abre el archivo, lo descarta y crea una base nueva con clave nueva', async () => {
    const { deps, log, keys } = setup({
      keys: { u1: KEY_A },
      keyWorks: [false, true],
      generated: [KEY_B],
    });
    const db = await openUserDb('u1', deps);

    expect(db).toBeDefined();
    expect(log).toContain('delete:saveria-u1.db');
    expect(keys.get('u1')).toBe(KEY_B);
    expect(log).toContain(`exec:PRAGMA key = "x'${KEY_B}'"`);
    // la conexión fallida se cerró antes de borrar el archivo
    expect(log.indexOf('close')).toBeLessThan(log.indexOf('delete:saveria-u1.db'));
    expect(log).toContain('migrate');
  });

  it('con un error distinto NO borra el archivo', async () => {
    const { deps, log, keys } = setup({
      keys: { u1: KEY_A },
      readError: new Error('disk I/O error'),
    });
    await expect(openUserDb('u1', deps)).rejects.toThrow('disk I/O error');
    expect(log.some((l) => l.startsWith('delete:'))).toBe(false);
    expect(keys.get('u1')).toBe(KEY_A);
  });

  it.each([
    ['con comillas', `${'a'.repeat(63)}"`],
    ['demasiado corta', 'abc'],
    ['con caracteres no hexadecimales', 'g'.repeat(64)],
    ['con mayúsculas', 'A'.repeat(64)],
    ['con una inyección', `${'a'.repeat(64)}'; DROP TABLE profile; --`],
  ])(
    'una clave guardada con formato inválido (%s) no llega a ningún PRAGMA',
    async (_n, badKey) => {
      const { deps, log } = setup({ keys: { u1: badKey } });
      await expect(openUserDb('u1', deps)).rejects.toThrow('formato inválido');
      expect(log.some((l) => l.startsWith('exec:'))).toBe(false);
      expect(log).not.toContain('open:saveria-u1.db');
    },
  );

  it('si la migración falla cierra la conexión y no deja la base abierta', async () => {
    const { deps, log } = setup({ keys: { u1: KEY_A }, migrateError: new Error('migración rota') });
    await expect(openUserDb('u1', deps)).rejects.toThrow('migración rota');
    expect(log).toContain('close');
    expect(getOpenUserDb()).toBeNull();
  });

  it('abrir otra vez al mismo usuario devuelve la misma base sin reabrir', async () => {
    const { deps, log } = setup({ keys: { u1: KEY_A } });
    const first = await openUserDb('u1', deps);
    const second = await openUserDb('u1', deps);
    expect(second).toBe(first);
    expect(log.filter((l) => l.startsWith('open:'))).toHaveLength(1);
  });

  it('abrir a otro usuario cierra la base del anterior', async () => {
    const { deps, log } = setup({ keys: { u1: KEY_A, u2: KEY_B } });
    await openUserDb('u1', deps);
    await openUserDb('u2', deps);
    expect(log.indexOf('close')).toBeLessThan(log.indexOf('open:saveria-u2.db'));
    expect(getOpenUserDb()?.userId).toBe('u2');
  });

  it('closeUserDb cierra la conexión sin borrar el archivo ni la clave (FR-010)', async () => {
    const { deps, log, keys } = setup({ keys: { u1: KEY_A } });
    await openUserDb('u1', deps);
    closeUserDb();
    expect(log).toContain('close');
    expect(log.some((l) => l.startsWith('delete:'))).toBe(false);
    expect(keys.get('u1')).toBe(KEY_A);
    expect(getOpenUserDb()).toBeNull();
  });
});
