import { beforeEach, describe, expect, it } from 'bun:test';
import { createForgotPassword } from '../../src/application/use-cases/forgot-password';
import {
  createCheckResetLink,
  createResetPassword,
  RESET_TTL_MS,
} from '../../src/application/use-cases/reset-password';
import {
  MAIL_LIMIT,
  MAIL_WINDOW_SEC,
  mailLimitKey,
} from '../../src/application/use-cases/send-verification-email';
import { DomainError } from '../../src/domain/errors';
import { makeSession, makeUser } from '../support/builders';
import {
  createUseCaseDeps,
  UNIT_PUBLIC_BASE_URL,
  type UseCaseDeps,
} from '../support/use-case-deps';

let deps: UseCaseDeps;
let forgot: ReturnType<typeof createForgotPassword>;

beforeEach(() => {
  deps = createUseCaseDeps();
  forgot = createForgotPassword(deps);
});

async function existingUser() {
  const user = makeUser({ email: 'ana@mail.com', passwordHash: 'fake:clave1234' });
  await deps.repositories.users.create(user);
  return user;
}

async function errorOf(promise: Promise<unknown>): Promise<DomainError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DomainError);
  return error as DomainError;
}

const resetTokens = (userId: string) =>
  [...deps.store.tokens.values()].filter((t) => t.userId === userId && t.kind === 'password_reset');

describe('5.3 pedir el enlace de recuperación', () => {
  it('con un correo registrado envía un enlace de 30 min guardado como SHA-256', async () => {
    const user = await existingUser();
    await forgot('  Ana@Mail.com ');

    const [mail] = deps.emailSender.to('ana@mail.com');
    expect(mail?.html).toContain(`${UNIT_PUBLIC_BASE_URL}/links/reset-password?token=`);
    const token = deps.emailSender.lastTokenTo('ana@mail.com') as string;
    const [stored] = resetTokens(user.id);
    expect(stored?.tokenHash).toBe(deps.random.sha256Hex(token));
    expect(stored?.expiresAt.getTime()).toBe(deps.clock.now().getTime() + RESET_TTL_MS);
    expect(RESET_TTL_MS).toBe(30 * 60 * 1000);
  });

  it('con un correo que no existe no envía nada y responde igual (sin error)', async () => {
    await forgot('nadie@mail.com');
    expect(deps.emailSender.sent).toHaveLength(0);
  });

  it('un correo con formato inválido → validation_error', async () => {
    expect((await errorOf(forgot('no-es-correo'))).code).toBe('validation_error');
  });

  it('pedir uno nuevo invalida el anterior', async () => {
    await existingUser();
    await forgot('ana@mail.com');
    const first = deps.emailSender.lastTokenTo('ana@mail.com') as string;
    await forgot('ana@mail.com');
    const second = deps.emailSender.lastTokenTo('ana@mail.com') as string;

    const check = createCheckResetLink(deps);
    expect(await check(first)).toBe('invalid');
    expect(await check(second)).toBe('valid');
  });

  it('comparte el límite de 3 correos por hora con la verificación (FR-035)', async () => {
    await existingUser();
    await deps.rateLimiter.hit(
      mailLimitKey(deps.random, 'ana@mail.com'),
      MAIL_LIMIT,
      MAIL_WINDOW_SEC,
    );
    await deps.rateLimiter.hit(
      mailLimitKey(deps.random, 'ana@mail.com'),
      MAIL_LIMIT,
      MAIL_WINDOW_SEC,
    );
    await forgot('ana@mail.com');
    await forgot('ana@mail.com');
    // sin error, pero solo salió uno
    expect(deps.emailSender.to('ana@mail.com')).toHaveLength(1);
  });
});

describe('5.4 / 5.5 crear la contraseña nueva', () => {
  async function issued() {
    const user = await existingUser();
    const sessions = [makeSession(user.id), makeSession(user.id)];
    for (const s of sessions) await deps.repositories.sessions.create(s);
    await forgot('ana@mail.com');
    return { user, sessions, token: deps.emailSender.lastTokenTo('ana@mail.com') as string };
  }

  it('cambia la contraseña, cierra TODAS las sesiones y el enlace deja de servir', async () => {
    const { user, sessions, token } = await issued();
    const reset = createResetPassword(deps);

    expect(
      await reset({ token, password: 'nueva5678', passwordConfirmation: 'nueva5678' }),
    ).toEqual({
      status: 'done',
    });
    expect(deps.store.users.get(user.id)?.passwordHash).toBe('fake:nueva5678');
    for (const s of sessions) {
      expect(deps.store.sessions.get(s.id)?.revokeReason).toBe('password_reset');
    }
    expect(await reset({ token, password: 'otra9999', passwordConfirmation: 'otra9999' })).toEqual({
      status: 'invalid',
    });
    expect(deps.store.users.get(user.id)?.passwordHash).toBe('fake:nueva5678');
  });

  it('revisar el enlace (GET) no lo consume', async () => {
    const { token } = await issued();
    const check = createCheckResetLink(deps);
    expect(await check(token)).toBe('valid');
    expect(await check(token)).toBe('valid');
  });

  it('una contraseña que no cumple las reglas no consume el enlace', async () => {
    const { user, token } = await issued();
    const reset = createResetPassword(deps);
    const result = await reset({ token, password: 'corta', passwordConfirmation: 'corta' });
    expect(result.status).toBe('invalid_input');
    if (result.status === 'invalid_input') expect(result.errors.password).toBeDefined();
    expect(deps.store.users.get(user.id)?.passwordHash).toBe('fake:clave1234');
    expect(await createCheckResetLink(deps)(token)).toBe('valid');
  });

  it('si las contraseñas no coinciden no cambia nada', async () => {
    const { token } = await issued();
    const result = await createResetPassword(deps)({
      token,
      password: 'nueva5678',
      passwordConfirmation: 'nueva5679',
    });
    expect(result.status).toBe('invalid_input');
    if (result.status === 'invalid_input') {
      expect(result.errors.passwordConfirmation).toBe('Las contraseñas no coinciden');
    }
  });

  it('un enlace vencido (más de 30 min) no sirve', async () => {
    const { token } = await issued();
    deps.clock.advance(RESET_TTL_MS + 1000);
    expect(await createCheckResetLink(deps)(token)).toBe('invalid');
    expect(
      await createResetPassword(deps)({
        token,
        password: 'nueva5678',
        passwordConfirmation: 'nueva5678',
      }),
    ).toEqual({ status: 'invalid' });
  });

  it('un enlace de verificación no sirve para recuperar', async () => {
    const user = await existingUser();
    const { createSendVerificationEmail } = await import(
      '../../src/application/use-cases/send-verification-email'
    );
    await createSendVerificationEmail(deps)(user);
    const verification = deps.emailSender.lastTokenTo('ana@mail.com') as string;
    expect(await createCheckResetLink(deps)(verification)).toBe('invalid');
  });

  it('el correo no contiene datos financieros (FR-036)', async () => {
    await existingUser();
    await forgot('ana@mail.com');
    const [mail] = deps.emailSender.to('ana@mail.com');
    const content = `${mail?.subject} ${mail?.html} ${mail?.text}`;
    // Palabras completas: "copia" no es "COP".
    expect(content).not.toMatch(/\$|\bCOP\b|\bUSD\b|\bsaldo|\bmovimiento|\befectivo\b/i);
  });
});
