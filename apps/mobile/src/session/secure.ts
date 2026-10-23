import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Datos sensibles en el Android Keystore (expo-secure-store).
 * SecureStore solo admite letras, números, `.`, `-` y `_` en las claves.
 */
const KEY = {
  deviceId: 'saveria.deviceId',
  refreshToken: 'saveria.refreshToken',
  lastUserId: 'saveria.lastUserId',
  pendingRevocation: 'saveria.pendingRevocation',
  dbKey: (userId: string) => `saveria.dbkey.${userId}`,
};

/** Id aleatorio del dispositivo; se crea una vez al instalar la app. */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY.deviceId);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(KEY.deviceId, id);
  return id;
}

export const getRefreshToken = () => SecureStore.getItemAsync(KEY.refreshToken);
export const setRefreshToken = (token: string) => SecureStore.setItemAsync(KEY.refreshToken, token);
export const clearRefreshToken = () => SecureStore.deleteItemAsync(KEY.refreshToken);

/** Usuario de la última sesión: indica qué base local abrir al arrancar. */
export const getLastUserId = () => SecureStore.getItemAsync(KEY.lastUserId);
export const setLastUserId = (userId: string) => SecureStore.setItemAsync(KEY.lastUserId, userId);
export const clearLastUserId = () => SecureStore.deleteItemAsync(KEY.lastUserId);

/**
 * Refresh token de un cierre de sesión hecho sin conexión: se envía a `POST /v1/auth/logout`
 * cuando vuelve la red, para revocar la sesión también en el servidor (FR-009).
 */
export const getPendingRevocation = () => SecureStore.getItemAsync(KEY.pendingRevocation);
export const setPendingRevocation = (token: string) =>
  SecureStore.setItemAsync(KEY.pendingRevocation, token);
export const clearPendingRevocation = () => SecureStore.deleteItemAsync(KEY.pendingRevocation);

/** Clave de cifrado de la base local de un usuario: 32 bytes en hexadecimal (64 caracteres). */
export const getDbKey = (userId: string) => SecureStore.getItemAsync(KEY.dbKey(userId));
export const setDbKey = (userId: string, hexKey: string) =>
  SecureStore.setItemAsync(KEY.dbKey(userId), hexKey);
export const deleteDbKey = (userId: string) => SecureStore.deleteItemAsync(KEY.dbKey(userId));

export function randomKeyHex(): string {
  return Array.from(Crypto.getRandomBytes(32), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}
