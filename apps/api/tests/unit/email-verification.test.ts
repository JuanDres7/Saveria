import { beforeEach, describe, expect, it } from 'bun:test';
import { PRIVACY_POLICY_VERSION } from '@saveria/shared';
import { createChangeEmail } from '../../src/application/use-cases/change-email';
import { createRegister, type RegisterInput } from '../../src/application/use-cases/register';
import { createResendVerification } from '../../src/application/use-cases/resend-verification';
import {
  createSendVerificationEmail,
  MAIL_LIMIT,
  MAIL_WINDOW_SEC,
  mailLimitKey,
  VERIFICATION_TTL_MS,
} from '../../src/application/use-cases/send-verification-email';
import {
  createCheckVerificationLink,
  createVerifyEmail,
} from '../../src/application/use-cases/verify-email';
import { DomainError } from '../../src/domain/errors';
import { makeProfile, makeUser } from '../support/builders';
import {
  createUseCaseDeps,
  UNIT_PUBLIC_BASE_URL,
  type UseCaseDeps,
} from '../support/use-case-deps';

let deps: UseCaseDeps;

beforeEach(() => {
  deps = createUseCaseDeps();
});

const DEVICE = { id: '0199a1b2-0000-7000-8000-00000000d001', name: 'Pixel 8' };

const registerInput = (overrides: Partial<RegisterInput> = {}): RegisterInput => ({
  email: 'ana@mail.com',
  password: 'clave1234',
  policyVersion: PRIVACY_POLICY_VERSION,
  policyAccepted: true,
  device: DEVICE,
  ...overrides,
});

async function errorOf(promise: Promise<unknown>): Promise<DomainError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DomainError);
  return error as DomainError;
}

/** Usuario sin verificar, con perfil, ya guardado. */
async function unverifiedUser(email = 'ana@mail.com') {
  const user = makeUser({ email, emailVerifiedAt: null });
  await deps.repositories.users.create(user);
  await deps.repositories.profiles.create(makeProfile(user.id));
  return user;
}

const verificationTokens = (userId: string) =>
  [...deps.store.tokens.values()].filter(
    (t) => t.userId === userId && t.kind === 'email_verification',
  );

describe('6.1 el registro envía el correo de verificación', () => {
  it('emite un token de 24 h guardado como SHA-256 y lo envía al correo normalizado', async () => {
    const { me } = await createRegister(deps)(registerInput({ email: '  Ana@Mail.com ' }));

    const [mail] = deps.emailSender.to('ana@mail.com');
    expect(mail).toBeDefined();
    const token = deps.emailSender.lastTokenTo('ana@mail.com') as string;
    expect(token.length).toBeGreaterThanOrEqual(43); // 32 bytes en base64url

    const [stored] = verificationTokens(me.id);
    expect(stored?.tokenHash).toBe(deps.random.sha256Hex(token));
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.targetEmail).toBe('ana@mail.com');
    expect(stored?.expiresAt.getTime()).toBe(deps.clock.now().getTime() + VERIFICATION_TTL_MS);
    expect(VERIFICATION_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('el enlace apunta a la página pública de verificación', async () => {
    await createRegister(deps)(registerInput());
    const [mail] = deps.emailSender.to('ana@mail.com');
    expect(mail?.html).toContain(`${UNIT_PUBLIC_BASE_URL}/links/verify-email?token=`);
    expect(mail?.text).toContain(`${UNIT_PUBLIC_BASE_URL}/links/verify-email?token=`);
  });

  it('si el envío falla, el registro igual se completa', async () => {
    deps.emailSender.send = async () => {
      throw new Error('proveedor caído');
    };
    const result = await createRegister(deps)(registerInput());
    expect(result.me.email).toBe('ana@mail.com');
    expect(deps.store.users.size).toBe(1);
  });

  it('el correo no contiene datos financieros (FR-036)', async () => {
    await createRegister(deps)(registerInput());
    const [mail] = deps.emailSender.to('ana@mail.com');
    const content = `${mail?.subject} ${mail?.html} ${mail?.text}`;
    // Palabras completas: "copia" no es "COP".
    expect(content).not.toMatch(/\$|\bCOP\b|\bUSD\b|\bsaldo|\bmovimiento|\befectivo\b/i);
  });
});

describe('verificar con el enlace', () => {
  async function issued() {
    const user = await unverifiedUser();
    await createSendVerificationEmail(deps)(user);
    return { user, token: deps.emailSender.lastTokenTo(user.email) as string };
  }

  it('6.2 un token vigente verifica el correo y deja de servir', async () => {
    const { user, token } = await issued();
    const verify = createVerifyEmail(deps);

    expect(await createCheckVerificationLink(deps)(token)).toBe('valid');
    expect(await verify(token)).toBe('verified');
    expect(deps.store.users.get(user.id)?.emailVerifiedAt).toEqual(deps.clock.now());
    expect(verificationTokens(user.id)[0]?.usedAt).not.toBeNull();

    expect(await verify(token)).toBe('invalid');
    expect(await createCheckVerificationLink(deps)(token)).toBe('invalid');
  });

  it('revisar el enlace (GET) no lo consume', async () => {
    const { user, token } = await issued();
    const check = createCheckVerificationLink(deps);
    expect(await check(token)).toBe('valid');
    expect(await check(token)).toBe('valid');
    expect(deps.store.users.get(user.id)?.emailVerifiedAt).toBeNull();
  });

  it('un token vencido no sirve', async () => {
    const { user, token } = await issued();
    deps.clock.advance(VERIFICATION_TTL_MS + 1000);
    expect(await createVerifyEmail(deps)(token)).toBe('invalid');
    expect(deps.store.users.get(user.id)?.emailVerifiedAt).toBeNull();
  });

  it('un token desconocido no sirve', async () => {
    expect(await createVerifyEmail(deps)('no-existe')).toBe('invalid');
    expect(await createCheckVerificationLink(deps)('')).toBe('invalid');
  });

  it('6.3 reenviar invalida el enlace anterior y el nuevo sí sirve', async () => {
    const { user, token: first } = await issued();
    await createResendVerification(deps)(user.id);
    const second = deps.emailSender.lastTokenTo(user.email) as string;
    expect(second).not.toBe(first);

    expect(await createVerifyEmail(deps)(first)).toBe('invalid');
    expect(await createVerifyEmail(deps)(second)).toBe('verified');
  });

  it('reenviar con el correo ya verificado no envía nada', async () => {
    const user = makeUser({ emailVerifiedAt: new Date('2026-10-20T00:00:00Z') });
    await deps.repositories.users.create(user);
    await createResendVerification(deps)(user.id);
    expect(deps.emailSender.sent).toHaveLength(0);
  });
});

describe('límite de correos (FR-035)', () => {
  it('máximo 3 por hora por dirección; los siguientes no se envían y no invalidan el enlace vigente', async () => {
    const user = await unverifiedUser();
    const resend = createResendVerification(deps);
    for (let i = 0; i < MAIL_LIMIT; i += 1) await resend(user.id);
    expect(deps.emailSender.to(user.email)).toHaveLength(3);
    const lastValid = deps.emailSender.lastTokenTo(user.email) as string;

    await resend(user.id);
    expect(deps.emailSender.to(user.email)).toHaveLength(3);
    expect(await createCheckVerificationLink(deps)(lastValid)).toBe('valid');

    deps.clock.advance(MAIL_WINDOW_SEC * 1000 + 1000);
    await resend(user.id);
    expect(deps.emailSender.to(user.email)).toHaveLength(4);
  });

  it('el contador suma verificación y recuperación: 2 de verificación + 1 de recuperación lo agotan', async () => {
    const user = await unverifiedUser();
    const resend = createResendVerification(deps);
    await resend(user.id);
    await resend(user.id);
    // un correo de recuperación usa el mismo contador (clave rl:mail:{sha256(email)})
    await deps.rateLimiter.hit(mailLimitKey(deps.random, user.email), MAIL_LIMIT, MAIL_WINDOW_SEC);

    await resend(user.id);
    expect(deps.emailSender.to(user.email)).toHaveLength(2);
  });

  it('la clave usa el hash del correo, nunca el correo en claro', () => {
    const key = mailLimitKey(deps.random, 'ana@mail.com');
    expect(key).toBe(`rl:mail:${deps.random.sha256Hex('ana@mail.com')}`);
    expect(key).not.toContain('ana');
  });
});

describe('corregir el correo (FR-034)', () => {
  it('sin verificar: cambia el correo, envía un enlace nuevo y los viejos dejan de servir', async () => {
    const user = await unverifiedUser('ana@mial.com');
    await createSendVerificationEmail(deps)(user);
    const old = deps.emailSender.lastTokenTo('ana@mial.com') as string;

    const me = await createChangeEmail(deps)(user.id, '  Ana@Mail.com ');
    expect(me.email).toBe('ana@mail.com');
    expect(me.emailVerified).toBe(false);

    expect(await createVerifyEmail(deps)(old)).toBe('invalid');
    const fresh = deps.emailSender.lastTokenTo('ana@mail.com') as string;
    expect(await createVerifyEmail(deps)(fresh)).toBe('verified');
  });

  it('un enlace emitido para el correo anterior no sirve aunque no se haya invalidado (target_email distinto)', async () => {
    const user = await unverifiedUser('ana@mial.com');
    await createSendVerificationEmail(deps)(user);
    const old = deps.emailSender.lastTokenTo('ana@mial.com') as string;
    // solo cambia el correo, sin pasar por el caso de uso
    await deps.repositories.users.updateEmail(user.id, 'ana@mail.com', deps.clock.now());
    expect(await createVerifyEmail(deps)(old)).toBe('invalid');
  });

  it('con el correo ya verificado → email_already_verified', async () => {
    const user = makeUser({ emailVerifiedAt: new Date('2026-10-20T00:00:00Z') });
    await deps.repositories.users.create(user);
    await deps.repositories.profiles.create(makeProfile(user.id));
    const error = await errorOf(createChangeEmail(deps)(user.id, 'otro@mail.com'));
    expect(error.code).toBe('email_already_verified');
  });

  it('un correo que ya usa otra cuenta → email_unavailable (genérico)', async () => {
    await unverifiedUser('otra@mail.com');
    const user = await unverifiedUser('ana@mial.com');
    const error = await errorOf(createChangeEmail(deps)(user.id, 'otra@mail.com'));
    expect(error.code).toBe('email_unavailable');
    expect(deps.store.users.get(user.id)?.email).toBe('ana@mial.com');
  });

  it('un correo con formato inválido → validation_error en email', async () => {
    const user = await unverifiedUser();
    const error = await errorOf(createChangeEmail(deps)(user.id, 'no-es-correo'));
    expect(error.code).toBe('validation_error');
    expect(error.fields?.email).toBeDefined();
  });
});
