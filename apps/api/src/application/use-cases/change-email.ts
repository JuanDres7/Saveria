import { emailSchema } from '@saveria/shared';
import { DomainError } from '../../domain/errors';
import type { MeDto } from '../dto';
import type { Repositories } from '../ports/repositories';
import { createGetMe } from './get-me';
import {
  createSendVerificationEmail,
  type SendVerificationEmailDeps,
} from './send-verification-email';

export interface ChangeEmailDeps extends SendVerificationEmailDeps {
  repositories: Pick<Repositories, 'users' | 'profiles' | 'accounts'>;
}

/**
 * Corrige el correo mientras no esté verificado (FR-034, caso límite "escribió mal su correo").
 * El correo nuevo recibe un enlace nuevo; los enlaces del correo anterior dejan de servir.
 */
export function createChangeEmail(deps: ChangeEmailDeps) {
  const sendVerificationEmail = createSendVerificationEmail(deps);
  const getMe = createGetMe(deps);

  return async function changeEmail(userId: string, rawEmail: string): Promise<MeDto> {
    const parsed = emailSchema.safeParse(rawEmail);
    if (!parsed.success) {
      throw new DomainError('validation_error', {
        fields: { email: parsed.error.issues[0]?.message ?? 'Correo inválido' },
      });
    }
    const email = parsed.data;

    const user = await deps.repositories.users.findById(userId);
    if (!user) throw new DomainError('unauthorized');
    if (user.emailVerifiedAt !== null) throw new DomainError('email_already_verified');

    if (email !== user.email) {
      const now = deps.clock.now();
      await deps.uow.run(async (repos) => {
        // Mensaje genérico: no revela que el correo ya tiene una cuenta.
        if ((await repos.users.updateEmail(user.id, email, now)) === 'email_taken') {
          throw new DomainError('email_unavailable');
        }
        await repos.oneTimeTokens.invalidateActive(user.id, 'email_verification', now);
      });
    }
    await sendVerificationEmail({ id: user.id, email });
    return getMe(user.id);
  };
}
