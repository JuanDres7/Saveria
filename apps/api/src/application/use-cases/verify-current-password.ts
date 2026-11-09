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
  // Se cuenta ANTES de verificar (ver `RateLimiter.release`). Un intento bloqueado devuelve su
  // cupo: no gasta bcrypt ni cuenta como fallo.
  const limit = await rateLimiter.hit(key, PASSWORD_CHECK_MAX, PASSWORD_CHECK_WINDOW_SEC);
  if (!limit.allowed) {
    await rateLimiter.release(key);
    throw new DomainError('too_many_attempts', { retryAfterSec: limit.retryAfterSec });
  }

  // `verify` nunca lanza: un hash inválido es `false`. Un fallo deja el intento contado.
  if (!(await hasher.verify(password, user.passwordHash))) {
    throw new DomainError('invalid_credentials');
  }
  await rateLimiter.reset(key);
}
