import type { UnitOfWork } from '../ports/repositories';
import { type FindLinkDeps, findValidLink } from './one-time-links';

export interface VerifyEmailDeps extends FindLinkDeps {
  uow: UnitOfWork;
}

/**
 * Revisa el enlace sin consumirlo. La página lo usa en el GET: los escáneres de correo abren los
 * enlaces solos, así que solo el POST verifica (research §4).
 */
export function createCheckVerificationLink(deps: VerifyEmailDeps) {
  return async function checkVerificationLink(token: string): Promise<'valid' | 'invalid'> {
    return (await findValidLink(deps, 'email_verification', token)) ? 'valid' : 'invalid';
  };
}

/** Consume el enlace y marca el correo como verificado (FR-031, escenario 6.2). */
export function createVerifyEmail(deps: VerifyEmailDeps) {
  return async function verifyEmail(token: string): Promise<'verified' | 'invalid'> {
    const found = await findValidLink(deps, 'email_verification', token);
    if (!found) return 'invalid';
    const now = deps.clock.now();
    return deps.uow.run(async (repos) => {
      // Otra petición lo consumió primero.
      if (!(await repos.oneTimeTokens.markUsed(found.link.id, now))) return 'invalid';
      if (found.user.emailVerifiedAt === null) {
        await repos.users.markEmailVerified(found.user.id, now);
      }
      return 'verified';
    });
  };
}
