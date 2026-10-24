import { AppState, type AppStateStatus } from 'react-native';
import type { ApiClient } from '../../api/client';
import { api } from '../../api/instance';
import { getOpenUserDb, type UserDb } from '../../db/open-user-db';
import { type Me, useSession } from '../../session/session-store';
import { AuthError } from '../auth/auth-service';
import { DrizzleLocalStore, mergeMe } from '../profile/local-store';

export interface VerificationServiceDeps {
  client: ApiClient;
  getOpenDb(): { userId: string; db: UserDb } | null;
  /** Guarda `me` en la base local y devuelve el `me` a mostrar. */
  syncMe(db: UserDb, me: Me): Me;
}

const NETWORK_MESSAGE = 'Necesitas internet para continuar';

type ApiError = { code: AuthError['code']; message: string; fields?: Record<string, string> };

/** Traduce el resultado de una llamada: sin red o con el error del contrato → `AuthError`. */
async function call<T>(request: () => Promise<{ data?: T; error?: ApiError }>): Promise<T> {
  let result: { data?: T; error?: ApiError };
  try {
    result = await request();
  } catch {
    throw new AuthError('network_error', NETWORK_MESSAGE);
  }
  if (result.data !== undefined) return result.data;
  const error = result.error;
  if (!error) throw new AuthError('internal_error', 'Ocurrió un error inesperado');
  throw new AuthError(error.code, error.message, error.fields);
}

export function createVerificationService(deps: VerificationServiceDeps) {
  /** Muestra el `me` del servidor (guardándolo primero en la base local, si está abierta). */
  function show(me: Me): Me {
    const open = deps.getOpenDb();
    const shown = open && open.userId === me.id ? deps.syncMe(open.db, me) : me;
    if (useSession.getState().status === 'signedIn') useSession.getState().setMe(shown);
    return shown;
  }

  /**
   * Consulta el estado de la cuenta en el servidor. Así la app refleja el correo verificado
   * (FR-037) y el bloqueo de los 7 días solo aparece cuando el servidor lo confirma (FR-032).
   */
  async function refresh(): Promise<Me> {
    return show(await call(() => deps.client.GET('/v1/me')));
  }

  /** Reenvía el correo de verificación (FR-034). La respuesta es siempre la misma (FR-035). */
  async function resend(): Promise<string> {
    const { message } = await call(() => deps.client.POST('/v1/auth/email/verification'));
    return message;
  }

  /** Corrige el correo mientras no esté verificado; el correo nuevo recibe un enlace nuevo. */
  async function changeEmail(email: string): Promise<Me> {
    return show(await call(() => deps.client.PUT('/v1/auth/email', { body: { email } })));
  }

  function refreshIfSignedInOnline(): void {
    const { status, isOnline } = useSession.getState();
    if (status === 'signedIn' && isOnline) void refresh().catch(() => undefined);
  }

  /**
   * Pregunta al servidor cuando vuelve la conexión (escenario 6.5) y cuando la app vuelve a primer
   * plano: así, tras confirmar el correo en el navegador, el recordatorio desaparece al volver.
   */
  function watchOnReconnect(
    appState: Pick<typeof AppState, 'addEventListener'> = AppState,
  ): () => void {
    const stopSession = useSession.subscribe((state, previous) => {
      if (state.isOnline && !previous.isOnline) refreshIfSignedInOnline();
    });
    const appStateSubscription = appState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') refreshIfSignedInOnline();
    });
    return () => {
      stopSession();
      appStateSubscription.remove();
    };
  }

  return { refresh, resend, changeEmail, watchOnReconnect };
}

export type VerificationService = ReturnType<typeof createVerificationService>;

export const verificationService = createVerificationService({
  client: api.client,
  getOpenDb: getOpenUserDb,
  syncMe: (db, me) => mergeMe(new DrizzleLocalStore(db), me),
});
