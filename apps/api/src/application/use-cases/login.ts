import { emailSchema } from '@saveria/shared';
import { DomainError } from '../../domain/errors';
import type { AuthResponseDto, DeviceInput } from '../dto';
import type { Repositories, UnitOfWork } from '../ports/repositories';
import type { Clock, PasswordHasher, Random, RateLimiter, TokenService } from '../ports/services';
import { toMe } from './get-me';
import { issueSession } from './issue-session';

/** FR-007: 5 fallos de una IP a un correo, o 100 fallos de una IP, en 15 minutos. */
export const LOGIN_WINDOW_SEC = 15 * 60;
export const LOGIN_MAX_PER_EMAIL = 5;
export const LOGIN_MAX_PER_IP = 100;

export interface LoginInput {
  email: string;
  password: string;
  device: DeviceInput;
  ip: string;
}

export interface LoginDeps {
  repositories: Pick<Repositories, 'users' | 'profiles' | 'accounts'>;
  uow: UnitOfWork;
  hasher: PasswordHasher;
  tokens: TokenService;
  random: Random;
  clock: Clock;
  rateLimiter: RateLimiter;
}

export function createLogin(deps: LoginDeps) {
  const { repositories, hasher, rateLimiter } = deps;

  return async function login(input: LoginInput): Promise<AuthResponseDto> {
    const parsed = emailSchema.safeParse(input.email);
    const email = parsed.success ? parsed.data : input.email.trim().toLowerCase();

    const emailKey = `rl:login:${input.ip}:${deps.random.sha256Hex(email)}`;
    const ipKey = `rl:login-ip:${input.ip}`;

    // Se consulta antes de verificar: un intento bloqueado no gasta bcrypt ni cuenta como fallo.
    const [byEmail, byIp] = await Promise.all([
      rateLimiter.peek(emailKey, LOGIN_MAX_PER_EMAIL),
      rateLimiter.peek(ipKey, LOGIN_MAX_PER_IP),
    ]);
    if (!byEmail.allowed || !byIp.allowed) {
      throw new DomainError('too_many_attempts', {
        retryAfterSec: Math.max(byEmail.retryAfterSec, byIp.retryAfterSec),
      });
    }

    const user = parsed.success ? await repositories.users.findByEmail(email) : null;
    let valid = false;
    if (user) {
      valid = await hasher.verify(input.password, user.passwordHash);
    } else {
      // Mismo trabajo que con una cuenta real: el tiempo no revela si el correo existe (FR-006).
      await hasher.verifyDummy(input.password);
    }

    if (!user || !valid) {
      await Promise.all([
        rateLimiter.hit(emailKey, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_SEC),
        rateLimiter.hit(ipKey, LOGIN_MAX_PER_IP, LOGIN_WINDOW_SEC),
      ]);
      throw new DomainError('invalid_credentials');
    }

    // Solo se reinicia el contador de este correo: el de la IP sigue frenando a quien prueba
    // muchos correos aunque tenga una cuenta propia válida.
    await rateLimiter.reset(emailKey);

    const now = deps.clock.now();
    const { tokens, profile, account } = await deps.uow.run(async (repos) => {
      // Un login nuevo desde el mismo dispositivo reemplaza la sesión anterior.
      await repos.sessions.revokeActiveForDevice(user.id, input.device.id, 'replaced', now);
      const issued = await issueSession(deps, repos.sessions, {
        userId: user.id,
        device: input.device,
      });
      const [profile, account] = await Promise.all([
        repos.profiles.findById(user.id),
        repos.accounts.findDefaultByUser(user.id),
      ]);
      return { tokens: issued.tokens, profile, account };
    });
    if (!profile) throw new DomainError('internal_error');

    return { tokens, me: toMe(user, profile, account, now) };
  };
}
