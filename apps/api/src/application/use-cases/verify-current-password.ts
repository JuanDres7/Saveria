import type { User } from '../../domain/entities';
import { DomainError } from '../../domain/errors';
import type { PasswordHasher, RateLimiter } from '../ports/services';

/** Cambiar la contraseña y borrar la cuenta comparten este límite (data-model, Redis). */
export const PASSWORD_CHECK_WINDOW_SEC = 15 * 60;
export const PASSWORD_CHECK_MAX = 5;

export interface VerifyCurrentPasswordDeps {
  hasher: PasswordHasher;
  rateLimiter: RateLimiter;
}

/**
 * Comprueba la contraseña actual de un usuario con sesión iniciada, con el límite
 * `rl:pwd:{userId}:{ip}`: 5 fallos en 15 minutos bloquean, aunque luego llegue la correcta.
 */
export async function verifyCurrentPassword(
  { hasher, rateLimiter }: VerifyCurrentPasswordDeps,
  { user, password, ip }: { user: User; password: string; ip: string },
): Promise<void> {
  const key = `rl:pwd:${user.id}:${ip}`;
  const limit = await rateLimiter.peek(key, PASSWORD_CHECK_MAX);
  if (!limit.allowed) {
    throw new DomainError('too_many_attempts', { retryAfterSec: limit.retryAfterSec });
  }

  if (!(await hasher.verify(password, user.passwordHash))) {
    await rateLimiter.hit(key, PASSWORD_CHECK_MAX, PASSWORD_CHECK_WINDOW_SEC);
    throw new DomainError('invalid_credentials');
  }
  await rateLimiter.reset(key);
}
