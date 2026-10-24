import type { Repositories } from '../ports/repositories';
import type { Clock } from '../ports/services';

/**
 * Cuánto se guardan las sesiones vencidas o revocadas (data-model: `sessions`). Las de una cuenta
 * borrada deben durar lo suficiente para que los otros dispositivos reciban `account_deleted`.
 */
export const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Una vez al día. */
export const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface PurgeExpiredDeps {
  repositories: Pick<Repositories, 'sessions' | 'oneTimeTokens'>;
  clock: Clock;
}

/**
 * Limpieza diaria: borra las sesiones vencidas o revocadas hace más de 30 días y los enlaces de un
 * solo uso que ya vencieron. Devuelve cuántos borró de cada uno.
 */
export function createPurgeExpired({ repositories, clock }: PurgeExpiredDeps) {
  return async function purgeExpired(): Promise<{ sessions: number; tokens: number }> {
    const now = clock.now();
    const sessions = await repositories.sessions.purgeBefore(
      new Date(now.getTime() - SESSION_RETENTION_MS),
    );
    const tokens = await repositories.oneTimeTokens.purgeBefore(now);
    return { sessions, tokens };
  };
}
