import type { Session } from '../../domain/entities';
import { DomainError } from '../../domain/errors';
import type { TokenPairDto } from '../dto';
import type { SessionRepository } from '../ports/repositories';
import type { Clock, Random, TokenService } from '../ports/services';
import { newRefreshToken, SESSION_TTL_MS, signTokenPair } from './issue-session';

/** Tiempo en que el token anterior todavía sirve, por si se perdió la respuesta del refresh. */
export const REFRESH_GRACE_MS = 60 * 1000;

const REFRESH_TOKEN = /^([0-9a-f-]{36})\.[A-Za-z0-9_-]+$/;

/** id de la sesión a la que dice pertenecer un refresh token, o `null` si no tiene la forma. */
export function sessionIdOf(refreshToken: string): string | null {
  return REFRESH_TOKEN.exec(refreshToken)?.[1] ?? null;
}

/** La sesión del token si el hash coincide con el actual o con el anterior. */
export async function findSessionByRefreshToken(
  sessions: SessionRepository,
  random: Random,
  refreshToken: string,
): Promise<{ session: Session; matches: 'current' | 'previous' } | null> {
  const sessionId = sessionIdOf(refreshToken);
  if (!sessionId) return null;
  const session = await sessions.findById(sessionId);
  if (!session) return null;

  const hash = random.sha256Hex(refreshToken);
  if (hash === session.refreshTokenHash) return { session, matches: 'current' };
  if (hash === session.previousRefreshTokenHash) return { session, matches: 'previous' };
  return null;
}

export interface RefreshDeps {
  repositories: { sessions: SessionRepository };
  tokens: TokenService;
  random: Random;
  clock: Clock;
}

/** Rota el refresh token y emite un par nuevo (FR-008). */
export function createRefresh({ repositories, tokens, random, clock }: RefreshDeps) {
  const { sessions } = repositories;

  return async function refresh(refreshToken: string): Promise<TokenPairDto> {
    const found = await findSessionByRefreshToken(sessions, random, refreshToken);
    // Un secreto que no coincide NO revoca: el sid viaja en cada JWT y no es secreto, así que
    // revocar aquí permitiría cerrar sesiones ajenas.
    if (!found) throw new DomainError('unauthorized');

    const { session, matches } = found;
    const now = clock.now();

    if (session.revokeReason === 'account_deleted') throw new DomainError('account_deleted');
    if (session.revokedAt !== null || session.userId === null) {
      throw new DomainError('unauthorized');
    }
    if (session.expiresAt.getTime() <= now.getTime()) throw new DomainError('unauthorized');

    const next = newRefreshToken(random, session.id);

    if (matches === 'current') {
      session.previousRefreshTokenHash = session.refreshTokenHash;
      session.rotatedAt = now;
    } else {
      const rotatedAt = session.rotatedAt?.getTime() ?? 0;
      if (now.getTime() - rotatedAt > REFRESH_GRACE_MS) {
        // El token anterior llegó tarde: alguien más lo tiene. Se corta la sesión.
        await sessions.revoke(session.id, 'reuse_detected', now);
        throw new DomainError('unauthorized');
      }
      // Reintento dentro de la ventana: el token anterior sigue siendo el "anterior" y
      // `rotatedAt` no se mueve, para que la ventana no se alargue con cada reintento.
    }

    session.refreshTokenHash = next.hash;
    session.lastUsedAt = now;
    session.expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await sessions.save(session);

    return signTokenPair(tokens, session.userId, session.id, next.token);
  };
}
