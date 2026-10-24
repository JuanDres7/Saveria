import type { User } from '../../domain/entities';
import type { UnitOfWork } from '../ports/repositories';
import type { Clock, EmailSender, EmailTemplates, Random, RateLimiter } from '../ports/services';

/** Vigencia del enlace de verificación (FR-033). */
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/** Correos por dirección, sumando verificación y recuperación (FR-035, data-model: Redis). */
export const MAIL_LIMIT = 3;
export const MAIL_WINDOW_SEC = 60 * 60;

/** Clave del límite de correos: usa el hash del correo, nunca el correo en claro. */
export function mailLimitKey(random: Pick<Random, 'sha256Hex'>, email: string): string {
  return `rl:mail:${random.sha256Hex(email)}`;
}

export const VERIFY_EMAIL_PATH = '/links/verify-email';

export interface SendVerificationEmailDeps {
  uow: UnitOfWork;
  random: Random;
  clock: Clock;
  rateLimiter: RateLimiter;
  emailSender: EmailSender;
  emailTemplates: EmailTemplates;
  publicBaseUrl: string;
}

/**
 * Emite un enlace de verificación nuevo para el correo actual del usuario y lo envía. Invalida
 * los anteriores (FR-033). Si la dirección ya recibió 3 correos en la última hora no hace nada,
 * y quien llama responde igual (FR-035).
 */
export function createSendVerificationEmail(deps: SendVerificationEmailDeps) {
  return async function sendVerificationEmail(
    user: Pick<User, 'id' | 'email'>,
  ): Promise<'sent' | 'limited'> {
    const limit = await deps.rateLimiter.hit(
      mailLimitKey(deps.random, user.email),
      MAIL_LIMIT,
      MAIL_WINDOW_SEC,
    );
    if (!limit.allowed) return 'limited';

    const token = deps.random.token(32);
    const now = deps.clock.now();
    await deps.uow.run(async (repos) => {
      await repos.oneTimeTokens.invalidateActive(user.id, 'email_verification', now);
      await repos.oneTimeTokens.create({
        id: deps.random.uuidV7(),
        userId: user.id,
        kind: 'email_verification',
        tokenHash: deps.random.sha256Hex(token),
        targetEmail: user.email,
        expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
        usedAt: null,
        invalidatedAt: null,
        createdAt: now,
      });
    });

    const link = new URL(VERIFY_EMAIL_PATH, deps.publicBaseUrl);
    link.searchParams.set('token', token);
    await deps.emailSender.send(
      deps.emailTemplates.verifyEmail({ to: user.email, link: link.toString() }),
    );
    return 'sent';
  };
}
