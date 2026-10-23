import * as SecureStore from 'expo-secure-store';
import {
  clearLastUserId,
  clearPendingRevocation,
  clearRefreshToken,
  deleteDbKey,
  getDbKey,
  getLastUserId,
  getOrCreateDeviceId,
  getPendingRevocation,
  getRefreshToken,
  randomKeyHex,
  setDbKey,
  setLastUserId,
  setPendingRevocation,
  setRefreshToken,
} from '../src/session/secure';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => store.clear());

describe('secure', () => {
  it('el id del dispositivo se crea una vez y no cambia', async () => {
    const first = await getOrCreateDeviceId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(await getOrCreateDeviceId()).toBe(first);
  });

  it('guarda, lee y borra el refresh token', async () => {
    expect(await getRefreshToken()).toBeNull();
    await setRefreshToken('r1');
    expect(await getRefreshToken()).toBe('r1');
    await clearRefreshToken();
    expect(await getRefreshToken()).toBeNull();
  });

  it('guarda, lee y borra el último usuario y la revocación pendiente', async () => {
    await setLastUserId('u1');
    await setPendingRevocation('r-pendiente');
    expect(await getLastUserId()).toBe('u1');
    expect(await getPendingRevocation()).toBe('r-pendiente');
    await clearLastUserId();
    await clearPendingRevocation();
    expect(await getLastUserId()).toBeNull();
    expect(await getPendingRevocation()).toBeNull();
  });

  it('la clave de la base es independiente por usuario', async () => {
    await setDbKey('u1', 'a'.repeat(64));
    await setDbKey('u2', 'b'.repeat(64));
    expect(await getDbKey('u1')).toBe('a'.repeat(64));
    await deleteDbKey('u1');
    expect(await getDbKey('u1')).toBeNull();
    expect(await getDbKey('u2')).toBe('b'.repeat(64));
  });

  it('todas las claves de SecureStore usan solo caracteres permitidos (sin ":")', async () => {
    await getOrCreateDeviceId();
    await setRefreshToken('r');
    await setLastUserId('0199a1b2-0000-7000-8000-000000000001');
    await setPendingRevocation('p');
    await setDbKey('0199a1b2-0000-7000-8000-000000000001', 'a'.repeat(64));
    expect(store.size).toBe(5);
    for (const key of store.keys()) expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('randomKeyHex devuelve 32 bytes en hexadecimal minúscula y distintos cada vez', () => {
    const key = randomKeyHex();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(randomKeyHex()).not.toBe(key);
  });
});
