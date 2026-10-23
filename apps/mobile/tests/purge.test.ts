import * as SecureStore from 'expo-secure-store';
import { type PurgeDeps, purgeUserData } from '../src/db/purge';
import {
  getDbKey,
  getLastUserId,
  getPendingRevocation,
  getRefreshToken,
  setDbKey,
  setLastUserId,
  setPendingRevocation,
  setRefreshToken,
} from '../src/session/secure';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

function fakeDeps(overrides: Partial<PurgeDeps> = {}) {
  const calls: string[] = [];
  const deps: PurgeDeps = {
    closeUserDb: () => void calls.push('closeUserDb'),
    deleteDatabaseSync: (name) => void calls.push(`deleteDatabase:${name}`),
    deleteDbKey: async (id) => void calls.push(`deleteDbKey:${id}`),
    clearRefreshToken: async () => void calls.push('clearRefreshToken'),
    clearPendingRevocation: async () => void calls.push('clearPendingRevocation'),
    getLastUserId: async () => 'u1',
    clearLastUserId: async () => void calls.push('clearLastUserId'),
    ...overrides,
  };
  return { deps, calls };
}

beforeEach(() => store.clear());

describe('purgeUserData', () => {
  it('cierra la base y borra el archivo, la clave y las credenciales', async () => {
    const { deps, calls } = fakeDeps();
    await purgeUserData('u1', deps);
    expect(calls).toEqual([
      'closeUserDb',
      'deleteDatabase:saveria-u1.db',
      'deleteDbKey:u1',
      'clearRefreshToken',
      'clearPendingRevocation',
      'clearLastUserId',
    ]);
  });

  it('cierra la base ANTES de borrar el archivo', async () => {
    const { deps, calls } = fakeDeps();
    await purgeUserData('u1', deps);
    expect(calls.indexOf('closeUserDb')).toBeLessThan(
      calls.indexOf('deleteDatabase:saveria-u1.db'),
    );
  });

  it('si el archivo ya no existe sigue borrando lo demás', async () => {
    const { deps, calls } = fakeDeps({
      deleteDatabaseSync: () => {
        throw new Error('database does not exist');
      },
    });
    await purgeUserData('u1', deps);
    expect(calls).toContain('deleteDbKey:u1');
    expect(calls).toContain('clearRefreshToken');
  });

  it('no borra el último usuario si pertenece a otro', async () => {
    const { deps, calls } = fakeDeps({ getLastUserId: async () => 'otro-usuario' });
    await purgeUserData('u1', deps);
    expect(calls).not.toContain('clearLastUserId');
  });

  it('con el almacenamiento seguro real: no queda clave, token ni usuario guardados', async () => {
    await setDbKey('u1', 'a'.repeat(64));
    await setRefreshToken('refresh');
    await setPendingRevocation('pendiente');
    await setLastUserId('u1');

    await purgeUserData('u1', {
      ...fakeDeps().deps,
      deleteDbKey: async (id) => SecureStore.deleteItemAsync(`saveria.dbkey.${id}`),
      clearRefreshToken: async () => SecureStore.deleteItemAsync('saveria.refreshToken'),
      clearPendingRevocation: async () => SecureStore.deleteItemAsync('saveria.pendingRevocation'),
      getLastUserId,
      clearLastUserId: async () => SecureStore.deleteItemAsync('saveria.lastUserId'),
    });

    expect(await getDbKey('u1')).toBeNull();
    expect(await getRefreshToken()).toBeNull();
    expect(await getPendingRevocation()).toBeNull();
    expect(await getLastUserId()).toBeNull();
  });
});
