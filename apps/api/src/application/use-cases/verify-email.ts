import type { OneTimeToken, User } from '../../domain/entities';
import type { Repositories, UnitOfWork } from '../ports/repositories';
import type { Clock, Random } from '../ports/services';

export interface VerifyEmailDeps {
  repositories: Pick<Repositories, 'users' | 'oneTimeTokens'>;
  uow: UnitOfWork;
  random: Pick<Random, 'sha256Hex'>;
  clock: Clock;
}

/** Los tokens tienen 32 bytes en base64url (43 caracteres); el contrato admite hasta 100. */
const MAX_TOKEN_LENGTH = 100;

/**
 * Busca el enlace y su usuario. Es válido si es de verificación, no se usó, no se invalidó, no
 * venció y se envió al correo que el usuario tiene ahora (un cambio de correo deja sin efecto los
 * enlaces viejos).
 */
async function findValid(
  deps: VerifyEmailDeps,
  token: string,
): Promise<{ link: OneTimeToken; user: User } | null> {
  if (token === '' || token.length > MAX_TOKEN_LENGTH) return null;
  const link = await deps.repositories.oneTimeTokens.findByHash(deps.random.sha256Hex(token));
  if (!link) return null;
  if (
    link.kind !== 'email_verification' ||
    link.usedAt !== null ||
    link.invalidatedAt !== null ||
    link.expiresAt.getTime() <= deps.clock.now().getTime()
  ) {
    return null;
  }
  const user = await deps.repositories.users.findById(link.userId);
  if (!user || user.email !== link.targetEmail) return null;
  return { link, user };
}

/**
 * Revisa el enlace sin consumirlo. La página lo usa en el GET: los escáneres de correo abren los
 * enlaces solos, así que solo el POST verifica (research §4).
 */
export function createCheckVerificationLink(deps: VerifyEmailDeps) {
  return async function checkVerificationLink(token: string): Promise<'valid' | 'invalid'> {
    return (await findValid(deps, token)) ? 'valid' : 'invalid';
  };
}

/** Consume el enlace y marca el correo como verificado (FR-031, escenario 6.2). */
export function createVerifyEmail(deps: VerifyEmailDeps) {
  return async function verifyEmail(token: string): Promise<'verified' | 'invalid'> {
    const found = await findValid(deps, token);
    if (!found) return 'invalid';
    const now = deps.clock.now();
    await deps.uow.run(async (repos) => {
      await repos.oneTimeTokens.markUsed(found.link.id, now);
      if (found.user.emailVerifiedAt === null)
        await repos.users.markEmailVerified(found.user.id, now);
    });
    return 'verified';
  };
}
