import { emailSchema } from '@saveria/shared';
import { DomainError } from '../../domain/errors';
import type { Repositories, UnitOfWork } from '../ports/repositories';
import type { Clock, EmailSender, EmailTemplates, Random, RateLimiter } from '../ports/services';
import { MAIL_LIMIT, MAIL_WINDOW_SEC, mailLimitKey } from './send-verification-email';

/** Vigencia del enlace de recuperación (FR-029). */
export const RESET_TTL_MS = 30 * 60 * 1000;

export const RESET_PASSWORD_PATH = '/links/reset-password';

export interface ForgotPasswordDeps {
  repositories: Pick<Repositories, 'users'>;
  uow: UnitOfWork;
  random: Random;
  clock: Clock;
  rateLimiter: RateLimiter;
  emailSender: EmailSender;
  emailTemplates: EmailTemplates;
  publicBaseUrl: string;
}

/**
 * Envía un enlace para crear una contraseña nueva (FR-028). Para quien llama el resultado es
 * siempre el mismo, exista o no el correo y aunque se pase el límite de correos (FR-030, FR-035):
 * solo un formato de correo inválido es un error.
 */
export function createForgotPassword(deps: ForgotPasswordDeps) {
  return async function forgotPassword(rawEmail: string): Promise<void> {
    const parsed = emailSchema.safeParse(rawEmail);
    if (!parsed.success) {
      throw new DomainError('validation_error', {
        fields: { email: parsed.error.issues[0]?.message ?? 'Correo inválido' },
      });
    }
    const email = parsed.data;

    // El límite se cuenta exista o no el correo: así se comporta igual en los dos casos.
    const limit = await deps.rateLimiter.hit(
      mailLimitKey(deps.random, email),
      MAIL_LIMIT,
      MAIL_WINDOW_SEC,
    );
    if (!limit.allowed) return;

    const user = await deps.repositories.users.findByEmail(email);
    if (!user) return;

    const token = deps.random.token(32);
    const now = deps.clock.now();
    await deps.uow.run(async (repos) => {
      await repos.oneTimeTokens.invalidateActive(user.id, 'password_reset', now);
      await repos.oneTimeTokens.create({
        id: deps.random.uuidV7(),
        userId: user.id,
        kind: 'password_reset',
        tokenHash: deps.random.sha256Hex(token),
        targetEmail: user.email,
        expiresAt: new Date(now.getTime() + RESET_TTL_MS),
        usedAt: null,
        invalidatedAt: null,
        createdAt: now,
      });
    });

    const link = new URL(RESET_PASSWORD_PATH, deps.publicBaseUrl);
    link.searchParams.set('token', token);
    await deps.emailSender.send(
      deps.emailTemplates.resetPassword({ to: user.email, link: link.toString() }),
    );
  };
}
