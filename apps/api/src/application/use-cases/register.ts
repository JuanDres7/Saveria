import { emailSchema, PRIVACY_POLICY_VERSION, passwordSchema } from '@saveria/shared';
import type { Profile, User } from '../../domain/entities';
import { DomainError } from '../../domain/errors';
import type { AuthResponseDto, DeviceInput } from '../dto';
import type { UnitOfWork } from '../ports/repositories';
import type { Clock, PasswordHasher, Random, TokenService } from '../ports/services';
import { toMe } from './get-me';
import { issueSession } from './issue-session';

export interface RegisterInput {
  email: string;
  password: string;
  policyVersion: string;
  policyAccepted: boolean;
  device: DeviceInput;
}

/** Sin repositorios fuera de la transacción: todo lo que escribe pasa por `uow`. */
export interface RegisterDeps {
  uow: UnitOfWork;
  hasher: PasswordHasher;
  tokens: TokenService;
  random: Random;
  clock: Clock;
}

function validate(input: RegisterInput): { email: string; password: string } {
  const email = emailSchema.safeParse(input.email);
  const password = passwordSchema.safeParse(input.password);
  const fields: Record<string, string> = {};
  if (!email.success) fields.email = email.error.issues[0]?.message ?? 'Correo inválido';
  if (!password.success) {
    fields.password = password.error.issues[0]?.message ?? 'Contraseña inválida';
  }
  if (!email.success || !password.success) throw new DomainError('validation_error', { fields });
  return { email: email.data, password: password.data };
}

/** Crea la cuenta (usuario + perfil inicial) e inicia sesión (FR-001 a FR-004). */
export function createRegister(deps: RegisterDeps) {
  return async function register(input: RegisterInput): Promise<AuthResponseDto> {
    const { email, password } = validate(input);
    if (!input.policyAccepted || input.policyVersion !== PRIVACY_POLICY_VERSION) {
      throw new DomainError('policy_not_accepted');
    }

    // bcrypt es lento: se calcula antes de abrir la transacción.
    const passwordHash = await deps.hasher.hash(password);
    const now = deps.clock.now();

    const user: User = {
      id: deps.random.uuidV7(),
      email,
      passwordHash,
      emailVerifiedAt: null,
      policyVersion: input.policyVersion,
      policyAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const profile: Profile = {
      id: user.id,
      aiName: null,
      countryCode: null,
      city: null,
      primaryCurrency: null,
      referenceCurrencies: [],
      aiMode: 'manual',
      onboardingStep: 'ai_name',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    return deps.uow.run(async (repos) => {
      // Mensaje genérico: no revela que el correo ya tiene una cuenta (escenario 1.3).
      if ((await repos.users.create(user)) === 'email_taken') {
        throw new DomainError('email_unavailable');
      }
      await repos.profiles.create(profile);
      const { tokens } = await issueSession(deps, repos.sessions, {
        userId: user.id,
        device: input.device,
      });
      return { tokens, me: toMe(user, profile, null, now) };
    });
  };
}
