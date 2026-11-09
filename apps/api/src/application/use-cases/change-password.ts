import { passwordSchema } from '@saveria/shared';
import { DomainError } from '../../domain/errors';
import type { Repositories, UnitOfWork } from '../ports/repositories';
import type { Clock, PasswordHasher, RateLimiter } from '../ports/services';
import { verifyCurrentPassword } from './verify-current-password';

export interface ChangePasswordInput {
  userId: string;
  /** Sesión desde la que se cambia: es la única que sigue activa. */
  sessionId: string;
  ip: string;
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordDeps {
  repositories: Pick<Repositories, 'users'>;
  uow: UnitOfWork;
  hasher: PasswordHasher;
  rateLimiter: RateLimiter;
  clock: Clock;
}

/**
 * Cambia la contraseña conociendo la actual (FR-018a): cierra todas las demás sesiones del usuario
 * y mantiene la del dispositivo actual. Con la contraseña actual incorrecta no cambia nada.
 */
export function createChangePassword(deps: ChangePasswordDeps) {
  return async function changePassword(input: ChangePasswordInput): Promise<void> {
    // La regla de la contraseña nueva se revisa primero: no gasta bcrypt ni cuenta como intento.
    const parsed = passwordSchema.safeParse(input.newPassword);
    if (!parsed.success) {
      throw new DomainError('validation_error', {
        fields: { newPassword: parsed.error.issues[0]?.message ?? 'Contraseña inválida' },
      });
    }

    const user = await deps.repositories.users.findById(input.userId);
    if (!user) throw new DomainError('unauthorized');
    await verifyCurrentPassword(deps, {
      user,
      password: input.currentPassword,
      ip: input.ip,
    });

    const passwordHash = await deps.hasher.hash(parsed.data);
    const now = deps.clock.now();
    await deps.uow.run(async (repos) => {
      await repos.users.updatePasswordHash(user.id, passwordHash, now);
      await repos.sessions.revokeAllForUser(user.id, 'password_changed', now, input.sessionId);
      // Un enlace de recuperación pedido antes del cambio ya no debe poder pisar la contraseña nueva.
      await repos.oneTimeTokens.invalidateActive(user.id, 'password_reset', now);
    });
  };
}
