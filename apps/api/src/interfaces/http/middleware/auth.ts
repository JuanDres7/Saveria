import type { MiddlewareHandler } from 'hono';
import type { SessionRepository } from '../../../application/ports/repositories';
import type { Clock, TokenService } from '../../../application/ports/services';
import { DomainError } from '../../../domain/errors';
import type { AppEnv } from '../context';

export interface AuthDeps {
  tokens: TokenService;
  sessions: SessionRepository;
  clock: Clock;
}

const BEARER = /^Bearer ([A-Za-z0-9._-]+)$/;

/**
 * Exige un access token válido Y una sesión activa.
 *
 * Verificar solo la firma no alcanza: un JWT sigue siendo válido hasta que vence. Por eso cada
 * petición consulta la sesión (`sid`, una búsqueda por clave primaria), y así cerrar sesión,
 * cambiar o recuperar la contraseña o borrar la cuenta cortan el acceso de inmediato
 * (FR-009, FR-018a, FR-025, FR-029).
 *
 * Todos los fallos responden `unauthorized`, salvo una cuenta borrada, que responde
 * `account_deleted` para que la app limpie sus datos locales. Ese código solo se revela a quien
 * presenta un token firmado por nosotros.
 */
export function requireAuth({ tokens, sessions, clock }: AuthDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = BEARER.exec(c.req.header('authorization') ?? '')?.[1];
    if (!token) throw new DomainError('unauthorized');

    const claims = await tokens.verifyAccess(token);
    if (!claims) throw new DomainError('unauthorized');

    const session = await sessions.findById(claims.sid);
    if (!session) throw new DomainError('unauthorized');

    if (session.revokeReason === 'account_deleted') throw new DomainError('account_deleted');
    if (session.revokedAt !== null) throw new DomainError('unauthorized');
    if (session.expiresAt.getTime() <= clock.now().getTime()) throw new DomainError('unauthorized');
    // Defensa en profundidad: el token y la sesión deben pertenecer al mismo usuario.
    if (session.userId !== claims.sub) throw new DomainError('unauthorized');

    c.set('userId', claims.sub);
    c.set('sessionId', session.id);
    await next();
  };
}
