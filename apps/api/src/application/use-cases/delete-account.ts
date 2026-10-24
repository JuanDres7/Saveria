import { DomainError } from '../../domain/errors';
import type { Repositories, UnitOfWork } from '../ports/repositories';
import type { Clock, PasswordHasher, RateLimiter } from '../ports/services';
import { verifyCurrentPassword } from './verify-current-password';

export interface DeleteAccountInput {
  userId: string;
  ip: string;
  password: string;
}

export interface DeleteAccountDeps {
  repositories: Pick<Repositories, 'users'>;
  uow: UnitOfWork;
  hasher: PasswordHasher;
  rateLimiter: RateLimiter;
  clock: Clock;
}

/**
 * Borra la cuenta y todos sus datos de forma definitiva (FR-023 a FR-025), confirmando con la
 * contraseña. En la misma transacción, antes de borrar el usuario, todas sus sesiones quedan como
 * `account_deleted` y sin nombre de dispositivo, para que los demás dispositivos limpien sus
 * datos locales. Perfil, cuentas y enlaces se van en cascada; el correo queda libre.
 */
export function createDeleteAccount(deps: DeleteAccountDeps) {
  return async function deleteAccount(input: DeleteAccountInput): Promise<void> {
    const user = await deps.repositories.users.findById(input.userId);
    if (!user) throw new DomainError('unauthorized');
    await verifyCurrentPassword(deps, { user, password: input.password, ip: input.ip });

    const now = deps.clock.now();
    await deps.uow.run(async (repos) => {
      await repos.sessions.markAccountDeleted(user.id, now);
      await repos.users.delete(user.id);
    });
  };
}
