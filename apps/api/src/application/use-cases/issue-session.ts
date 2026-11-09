import type { Session } from '../../domain/entities';
import type { DeviceInput, TokenPairDto } from '../dto';
import type { SessionRepository } from '../ports/repositories';
import type { Clock, Random, TokenService } from '../ports/services';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_SECRET_BYTES = 32;

export interface IssueSessionDeps {
  tokens: TokenService;
  random: Random;
  clock: Clock;
}

/**
 * Refresh token opaco `<sid>.<32 bytes base64url>`. El prefijo permite encontrar la sesión por
 * clave primaria; en la base solo se guarda el SHA-256 del token completo.
 */
export function newRefreshToken(random: Random, sessionId: string) {
  const token = `${sessionId}.${random.token(REFRESH_SECRET_BYTES)}`;
  return { token, hash: random.sha256Hex(token) };
}

export async function signTokenPair(
  tokens: TokenService,
  userId: string,
  sessionId: string,
  refreshToken: string,
): Promise<TokenPairDto> {
  const access = await tokens.signAccess({ sub: userId, sid: sessionId });
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshToken,
  };
}

/**
 * Crea una sesión nueva y su par de tokens. Lo usan el registro y el login; recibe el repositorio
 * de sesiones para poder correr dentro de la transacción de quien lo llama.
 */
export async function issueSession(
  { tokens, random, clock }: IssueSessionDeps,
  sessions: SessionRepository,
  { userId, device }: { userId: string; device: DeviceInput },
): Promise<{ session: Session; tokens: TokenPairDto }> {
  const now = clock.now();
  const id = random.uuidV7();
  const refresh = newRefreshToken(random, id);

  const session: Session = {
    id,
    userId,
    deviceId: device.id,
    deviceName: device.name ?? null,
    refreshTokenHash: refresh.hash,
    previousRefreshTokenHash: null,
    rotatedAt: null,
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    revokedAt: null,
    revokeReason: null,
  };
  await sessions.create(session);

  return { session, tokens: await signTokenPair(tokens, userId, id, refresh.token) };
}
