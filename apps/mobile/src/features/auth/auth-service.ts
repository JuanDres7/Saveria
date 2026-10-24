import { PRIVACY_POLICY_VERSION } from '@saveria/shared';
import * as Device from 'expo-device';
import type { ApiClient } from '../../api/client';
import { API_URL, api } from '../../api/instance';
import type { components } from '../../api/schema';
import { closeUserDb, getOpenUserDb, openUserDb, type UserDb } from '../../db/open-user-db';
import { purgeUserData } from '../../db/purge';
import { outboxFor } from '../../outbox/user-outbox';
import {
  clearPendingRevocation,
  clearRefreshToken,
  getOrCreateDeviceId,
  getPendingRevocation,
  getRefreshToken,
  setLastUserId,
  setPendingRevocation,
  setRefreshToken,
} from '../../session/secure';
import { type Me, useSession } from '../../session/session-store';
import { DrizzleLocalStore, mergeMe } from '../profile/local-store';

type AuthResponse = components['schemas']['AuthResponse'];
type ErrorCode = components['schemas']['Error']['code'] | 'network_error';

/** Error que las pantallas muestran al usuario. */
export class AuthError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

const NETWORK_MESSAGE = 'Necesitas internet para continuar';

export interface AuthServiceDeps {
  baseUrl: string;
  /** `fetch` SIN Authorization: para revocar un refresh token que no es el de la sesión actual. */
  fetchImpl: typeof fetch;
  client: ApiClient;
  openDb(userId: string): Promise<UserDb>;
  closeDb(): void;
  getOpenDb(): { userId: string; db: UserDb } | null;
  /** Guarda `me` en la base local y devuelve el `me` a mostrar (con el progreso local más nuevo). */
  syncMe(db: UserDb, me: Me): Me;
  outboxFor(db: UserDb): { count(): number; flush(): Promise<unknown> };
  deviceName(): string | null;
  /** Borra el archivo de la base, su clave y las credenciales de ese usuario. */
  purgeUserData(userId: string): Promise<void>;
}

export const ACCOUNT_DELETED_NOTICE = 'Tu cuenta y todos tus datos fueron borrados.';

export function pendingChangesNotice(count: number): string {
  return count === 1
    ? 'Tienes 1 cambio sin sincronizar; se enviará cuando vuelvas a entrar'
    : `Tienes ${count} cambios sin sincronizar; se enviarán cuando vuelvas a entrar`;
}

export function createAuthService(deps: AuthServiceDeps) {
  async function device() {
    const name = deps.deviceName()?.slice(0, 80);
    return { id: await getOrCreateDeviceId(), ...(name ? { name } : {}) };
  }

  type ApiError = { code: ErrorCode; message: string; fields?: Record<string, string> };

  /** Hace la llamada y traduce sus fallos a `AuthError` (sin red, o el error del contrato). */
  async function call(
    request: () => Promise<{ data?: AuthResponse; error?: ApiError }>,
  ): Promise<AuthResponse> {
    let result: { data?: AuthResponse; error?: ApiError };
    try {
      result = await request();
    } catch {
      throw new AuthError('network_error', NETWORK_MESSAGE);
    }
    if (result.data) return result.data;
    const error = result.error;
    if (!error) throw new AuthError('internal_error', 'Ocurrió un error inesperado');
    throw new AuthError(error.code, error.message, error.fields);
  }

  /**
   * Envía a `POST /v1/auth/logout` el refresh token de un cierre de sesión que no llegó al
   * servidor. Va sin Authorization: si viajara el access token del usuario actual, el servidor
   * revocaría esa sesión en vez de la vieja. Solo se borra cuando el servidor confirma.
   */
  async function sendPendingRevocation(): Promise<void> {
    const refreshToken = await getPendingRevocation();
    if (!refreshToken) return;
    try {
      const response = await deps.fetchImpl(
        new Request(`${deps.baseUrl}/v1/auth/logout`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        }),
      );
      if (response.ok) await clearPendingRevocation();
    } catch {
      // Sin red: se intenta de nuevo cuando vuelva la conexión.
    }
  }

  /**
   * Orden importante: primero se guardan las credenciales y se abre la base del usuario; solo
   * después la sesión pasa a `signedIn` (las guardas de navegación hacen el resto).
   */
  async function completeSignIn({ tokens, me }: AuthResponse): Promise<void> {
    await setRefreshToken(tokens.refreshToken);
    await setLastUserId(me.id);
    const db = await deps.openDb(me.id);
    const shown = deps.syncMe(db, me);
    useSession.getState().setNotice(null);
    useSession.getState().setSignedIn({ me: shown, accessToken: tokens.accessToken });

    // En segundo plano: los cambios hechos antes de cerrar sesión y una revocación pendiente.
    void deps
      .outboxFor(db)
      .flush()
      .catch(() => undefined);
    void sendPendingRevocation();
  }

  async function register(input: {
    email: string;
    password: string;
    policyAccepted: boolean;
  }): Promise<void> {
    const body = {
      email: input.email,
      password: input.password,
      policyVersion: PRIVACY_POLICY_VERSION,
      policyAccepted: input.policyAccepted as true,
      device: await device(),
    };
    await completeSignIn(await call(() => deps.client.POST('/v1/auth/register', { body })));
  }

  async function login(input: { email: string; password: string }): Promise<void> {
    const body = { email: input.email, password: input.password, device: await device() };
    await completeSignIn(await call(() => deps.client.POST('/v1/auth/login', { body })));
  }

  /**
   * Cambia la contraseña conociendo la actual (FR-018a). Requiere conexión. El servidor cierra
   * las demás sesiones; la de este dispositivo sigue activa.
   */
  async function changePassword(input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    let result: Awaited<ReturnType<typeof requestPasswordChange>>;
    try {
      result = await requestPasswordChange(input);
    } catch {
      throw new AuthError('network_error', NETWORK_MESSAGE);
    }
    if (result.response.ok) return;
    const error = result.error;
    if (!error) throw new AuthError('internal_error', 'Ocurrió un error inesperado');
    throw new AuthError(error.code, error.message, error.fields);
  }

  function requestPasswordChange(body: { currentPassword: string; newPassword: string }) {
    return deps.client.POST('/v1/auth/password/change', { body });
  }

  /** Cambios guardados en el dispositivo que todavía no llegan al servidor. */
  function pendingChanges(): number {
    const open = deps.getOpenDb();
    return open ? deps.outboxFor(open.db).count() : 0;
  }

  /**
   * Borra la cuenta y todos sus datos (FR-023, FR-024), confirmando con la contraseña. Requiere
   * conexión. Solo cuando el servidor confirma se borran la base local (con sus cambios
   * pendientes), su clave y las credenciales, y la sesión pasa a `signedOut`.
   */
  async function deleteAccount(password: string): Promise<void> {
    const userId = useSession.getState().me?.id;
    let result: Awaited<ReturnType<typeof requestAccountDeletion>>;
    try {
      result = await requestAccountDeletion(password);
    } catch {
      throw new AuthError('network_error', NETWORK_MESSAGE);
    }
    if (!result.response.ok) {
      const error = result.error;
      if (!error) throw new AuthError('internal_error', 'Ocurrió un error inesperado');
      throw new AuthError(error.code, error.message, error.fields);
    }

    if (userId) await deps.purgeUserData(userId);
    const session = useSession.getState();
    session.setSignedOut();
    session.setNotice(ACCOUNT_DELETED_NOTICE);
  }

  function requestAccountDeletion(password: string) {
    return deps.client.DELETE('/v1/me', { body: { password } });
  }

  /**
   * Cierra la sesión en el dispositivo de inmediato, con o sin conexión (FR-009, FR-010a):
   * borra el refresh token, cierra la base local SIN borrarla y pasa a `signedOut`. Si hay
   * cambios sin enviar muestra un aviso, sin bloquear. La revocación en el servidor se manda
   * ahora si hay red o cuando vuelva.
   */
  async function logout(): Promise<{ pendingChanges: number }> {
    const pending = pendingChanges();

    const refreshToken = await getRefreshToken();
    // Se guarda antes de borrar la sesión: si la app se cierra a mitad, no se pierde.
    if (refreshToken) await setPendingRevocation(refreshToken);
    await clearRefreshToken();
    deps.closeDb();

    const session = useSession.getState();
    session.setSignedOut();
    session.setNotice(pending > 0 ? pendingChangesNotice(pending) : null);

    if (session.isOnline) await sendPendingRevocation();
    return { pendingChanges: pending };
  }

  /** Envía la revocación pendiente cada vez que vuelve la conexión. Devuelve cómo dejar de escuchar. */
  function watchPendingRevocation(): () => void {
    return useSession.subscribe((state, previous) => {
      if (state.isOnline && !previous.isOnline) void sendPendingRevocation();
    });
  }

  return {
    register,
    login,
    logout,
    changePassword,
    pendingChanges,
    deleteAccount,
    sendPendingRevocation,
    watchPendingRevocation,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

/** Servicio de la app, con la red, la base local y el outbox reales. */
export const authService = createAuthService({
  baseUrl: API_URL,
  fetchImpl: (...args) => fetch(...args),
  client: api.client,
  openDb: (userId) => openUserDb(userId),
  closeDb: closeUserDb,
  getOpenDb: getOpenUserDb,
  syncMe: (db, me) => mergeMe(new DrizzleLocalStore(db), me),
  outboxFor,
  deviceName: () => Device.modelName,
  purgeUserData: (userId) => purgeUserData(userId),
});
