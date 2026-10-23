import type { SessionRepository } from '../ports/repositories';
import type { Clock, Random, TokenService } from '../ports/services';
import { findSessionByRefreshToken } from './refresh';

export interface LogoutInput {
  accessToken?: string | null;
  refreshToken?: string | null;
}

export interface LogoutDeps {
  repositories: { sessions: SessionRepository };
  tokens: TokenService;
  random: Random;
  clock: Clock;
}

/**
 * Cierra la sesión del access token o, si no sirve (vencido, ausente), la del `refreshToken`
 * (actual o anterior). Así se puede revocar después un logout hecho sin conexión (FR-009).
 * Nunca falla: quien llama responde 204 siempre, para no revelar nada.
 */
export function createLogout({ repositories, tokens, random, clock }: LogoutDeps) {
  const { sessions } = repositories;

  async function sessionFromAccess(accessToken: string): Promise<string | null> {
    const claims = await tokens.verifyAccess(accessToken);
    if (!claims) return null;
    const session = await sessions.findById(claims.sid);
    if (!session || session.revokedAt !== null || session.userId !== claims.sub) return null;
    return session.id;
  }

  return async function logout({ accessToken, refreshToken }: LogoutInput): Promise<void> {
    let sessionId = accessToken ? await sessionFromAccess(accessToken) : null;
    if (!sessionId && refreshToken) {
      sessionId =
        (await findSessionByRefreshToken(sessions, random, refreshToken))?.session.id ?? null;
    }
    if (sessionId) await sessions.revoke(sessionId, 'logout', clock.now());
  };
}
