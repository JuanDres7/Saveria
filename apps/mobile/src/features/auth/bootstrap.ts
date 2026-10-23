import { getRefreshToken } from '../../session/secure';
import { useSession } from '../../session/session-store';

/**
 * Decide con qué estado arranca la app.
 *
 * Por ahora, sin sesión guardada pasa a `signedOut`. El arranque con sesión guardada (abrir la
 * base local, mostrar la app sin pedir la contraseña y refrescar en segundo plano) lo completa la
 * historia 5, que reemplaza este archivo.
 */
export async function bootstrapSession(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken === null) {
    useSession.getState().setSignedOut();
    return;
  }
  // Todavía no existe el inicio de sesión (historia 1): no puede haber un token guardado.
  useSession.getState().setSignedOut();
}
