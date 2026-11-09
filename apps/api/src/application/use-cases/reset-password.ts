import { passwordSchema } from '@saveria/shared';
import type { UnitOfWork } from '../ports/repositories';
import type { PasswordHasher } from '../ports/services';
import { type FindLinkDeps, findValidLink } from './one-time-links';

export { RESET_TTL_MS } from './forgot-password';

export interface ResetPasswordDeps extends FindLinkDeps {
  uow: UnitOfWork;
  hasher: PasswordHasher;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
  passwordConfirmation: string;
}

export type ResetPasswordResult =
  | { status: 'done' }
  | { status: 'invalid' }
  /** El enlace sigue sirviendo: la página vuelve a mostrar el formulario con los errores. */
  | { status: 'invalid_input'; errors: { password?: string; passwordConfirmation?: string } };

/** Revisa el enlace sin consumirlo (GET de la página; research §4). */
export function createCheckResetLink(deps: FindLinkDeps) {
  return async function checkResetLink(token: string): Promise<'valid' | 'invalid'> {
    return (await findValidLink(deps, 'password_reset', token)) ? 'valid' : 'invalid';
  };
}

/**
 * Crea la contraseña nueva con el enlace del correo (FR-028, FR-029): valida FR-003, consume el
 * enlace y cierra TODAS las sesiones del usuario (escenario 5.4).
 */
export function createResetPassword(deps: ResetPasswordDeps) {
  return async function resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResult> {
    const found = await findValidLink(deps, 'password_reset', input.token);
    if (!found) return { status: 'invalid' };

    const parsed = passwordSchema.safeParse(input.password);
    if (!parsed.success) {
      return {
        status: 'invalid_input',
        errors: { password: parsed.error.issues[0]?.message ?? 'Contraseña inválida' },
      };
    }
    if (input.password !== input.passwordConfirmation) {
      return {
        status: 'invalid_input',
        errors: { passwordConfirmation: 'Las contraseñas no coinciden' },
      };
    }

    // bcrypt es lento: se calcula antes de abrir la transacción.
    const passwordHash = await deps.hasher.hash(parsed.data);
    const now = deps.clock.now();
    return deps.uow.run(async (repos): Promise<ResetPasswordResult> => {
      // Otra petición lo consumió primero: el enlace sirve una sola vez (FR-029).
      if (!(await repos.oneTimeTokens.markUsed(found.link.id, now))) return { status: 'invalid' };
      await repos.users.updatePasswordHash(found.user.id, passwordHash, now);
      await repos.sessions.revokeAllForUser(found.user.id, 'password_reset', now);
      return { status: 'done' };
    });
  };
}
