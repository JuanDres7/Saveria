import { api } from '../../api/instance';
import { closeUserDb, openUserDb, type UserDb } from '../../db/open-user-db';
import { outboxFor } from '../../outbox/user-outbox';
import { getLastUserId, getRefreshToken } from '../../session/secure';
import { type Me, useSession } from '../../session/session-store';
import { DrizzleLocalStore, readLocalMe } from '../profile/local-store';
import { verificationService } from '../verification/verification-service';

export interface BootstrapDeps {
  getRefreshToken(): Promise<string | null>;
  getLastUserId(): Promise<string | null>;
  openDb(userId: string): Promise<UserDb>;
  closeDb(): void;
  readLocalMe(db: UserDb, userId: string): Me | null;
  /**
   * Pide un access token nuevo con el refresh token guardado. `false` si no hay red (la sesión
   * sigue) o si la sesión ya no sirve (el cliente pasa a `signedOut` y conserva la base local).
   */
  refreshSession(): Promise<boolean>;
  /** Con la sesión renovada: trae el `me` del servidor y envía los cambios pendientes. */
  afterRefresh(db: UserDb): Promise<void>;
}

/**
 * Decide con qué estado arranca la app (escenario 5.1, SC-003).
 *
 * Con una sesión guardada abre la base local y muestra la app de inmediato, también sin conexión,
 * sin esperar a la red. La sesión se renueva en segundo plano. Si ya venció, el cliente de la API
 * pasa a `signedOut` y conserva la base con sus cambios pendientes: al volver a entrar con el
 * mismo usuario se envían (escenario 5.2).
 */
export function createBootstrap(deps: BootstrapDeps) {
  return async function bootstrapSession(): Promise<void> {
    const session = useSession.getState();
    const [refreshToken, userId] = await Promise.all([
      deps.getRefreshToken(),
      deps.getLastUserId(),
    ]);
    if (refreshToken === null || userId === null) {
      session.setSignedOut();
      return;
    }

    let db: UserDb;
    try {
      db = await deps.openDb(userId);
    } catch {
      session.setSignedOut();
      return;
    }
    const me = deps.readLocalMe(db, userId);
    if (!me) {
      // La base no tiene los datos de la cuenta: se pide entrar para traerlos del servidor.
      deps.closeDb();
      session.setSignedOut();
      return;
    }

    session.setSignedIn({ me, accessToken: null });

    void (async () => {
      if (await deps.refreshSession()) await deps.afterRefresh(db);
    })().catch(() => undefined);
  };
}

export const bootstrapSession = createBootstrap({
  getRefreshToken,
  getLastUserId,
  openDb: (userId) => openUserDb(userId),
  closeDb: closeUserDb,
  readLocalMe: (db, userId) => readLocalMe(new DrizzleLocalStore(db), userId),
  refreshSession: () => api.refreshSession(),
  afterRefresh: async (db) => {
    await verificationService.refresh().catch(() => undefined);
    await outboxFor(db)
      .flush()
      .catch(() => undefined);
  },
});
