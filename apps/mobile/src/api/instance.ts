import { closeUserDb } from '../db/open-user-db';
import { purgeUserData } from '../db/purge';
import {
  clearRefreshToken,
  getLastUserId,
  getRefreshToken,
  setRefreshToken,
} from '../session/secure';
import { useSession } from '../session/session-store';
import { createApiClient } from './client';

/** En el emulador de Android, 10.0.2.2 es el localhost del PC. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000';

/** Cliente de la app, conectado al estado de sesión y al almacenamiento seguro. */
export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => useSession.getState().accessToken,
  getRefreshToken,
  onTokens: async ({ accessToken, refreshToken }) => {
    await setRefreshToken(refreshToken);
    useSession.getState().setAccessToken(accessToken);
  },
  onSessionLost: async (reason) => {
    const userId = await getLastUserId();
    if (reason === 'account_deleted' && userId) {
      // La cuenta ya no existe: se borran el archivo, la clave y las credenciales de este usuario.
      await purgeUserData(userId);
    } else {
      // Sesión vencida: la base local se conserva (con sus cambios pendientes) pero se cierra,
      // para que sus datos no queden visibles hasta volver a entrar.
      closeUserDb();
      await clearRefreshToken();
    }
    useSession.getState().setSignedOut();
  },
});
