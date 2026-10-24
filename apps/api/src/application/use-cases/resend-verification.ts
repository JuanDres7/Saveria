import { DomainError } from '../../domain/errors';
import type { Repositories } from '../ports/repositories';
import {
  createSendVerificationEmail,
  type SendVerificationEmailDeps,
} from './send-verification-email';

export interface ResendVerificationDeps extends SendVerificationEmailDeps {
  repositories: Pick<Repositories, 'users'>;
}

/**
 * Reenvía el correo de verificación (FR-034). Si el correo ya está verificado o se pasó el límite
 * de correos no envía nada; la ruta responde igual en todos los casos (FR-035).
 */
export function createResendVerification(deps: ResendVerificationDeps) {
  const sendVerificationEmail = createSendVerificationEmail(deps);
  return async function resendVerification(userId: string): Promise<void> {
    const user = await deps.repositories.users.findById(userId);
    if (!user) throw new DomainError('unauthorized');
    if (user.emailVerifiedAt !== null) return;
    await sendVerificationEmail(user);
  };
}
