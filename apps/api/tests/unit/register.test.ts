import { beforeEach, describe, expect, it } from 'bun:test';
import { PRIVACY_POLICY_VERSION } from '@saveria/shared';
import { createRegister, type RegisterInput } from '../../src/application/use-cases/register';
import { DomainError } from '../../src/domain/errors';
import { makeUser } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

let deps: UseCaseDeps;
let register: ReturnType<typeof createRegister>;

beforeEach(() => {
  deps = createUseCaseDeps();
  register = createRegister(deps);
});

const DEVICE = { id: '0199a1b2-0000-7000-8000-00000000d001', name: 'Pixel 8' };

const input = (overrides: Partial<RegisterInput> = {}): RegisterInput => ({
  email: 'ana@mail.com',
  password: 'clave1234',
  policyVersion: PRIVACY_POLICY_VERSION,
  policyAccepted: true,
  device: DEVICE,
  ...overrides,
});

async function expectError(promise: Promise<unknown>, code: DomainError['code']) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
  return error as DomainError;
}

describe('register', () => {
  it('normaliza el correo (espacios y mayúsculas) antes de guardarlo', async () => {
    const result = await register(input({ email: '  Ana@Mail.COM ' }));
    expect(result.me.email).toBe('ana@mail.com');
    expect([...deps.store.users.values()][0]?.email).toBe('ana@mail.com');
  });

  it.each([
    ['muy corta', 'abc12'],
    ['sin número', 'clavelarga'],
    ['sin letra', '12345678'],
  ])('contraseña inválida (%s) → validation_error con el campo password', async (_n, password) => {
    const error = await expectError(register(input({ password })), 'validation_error');
    expect(error.fields?.password).toBeDefined();
    expect(deps.store.users.size).toBe(0);
  });

  it('correo con formato inválido → validation_error', async () => {
    const error = await expectError(register(input({ email: 'no-es-correo' })), 'validation_error');
    expect(error.fields?.email).toBeDefined();
  });

  it('policyAccepted falso → policy_not_accepted', async () => {
    await expectError(register(input({ policyAccepted: false })), 'policy_not_accepted');
    expect(deps.store.users.size).toBe(0);
  });

  it('versión de política distinta de la vigente → policy_not_accepted', async () => {
    await expectError(register(input({ policyVersion: '2020-01-v0' })), 'policy_not_accepted');
    expect(deps.store.users.size).toBe(0);
  });

  it('correo ya registrado → email_unavailable, sin crear nada', async () => {
    await deps.repositories.users.create(makeUser({ email: 'ana@mail.com' }));
    await expectError(register(input({ email: 'ANA@mail.com' })), 'email_unavailable');
    expect(deps.store.users.size).toBe(1);
    expect(deps.store.profiles.size).toBe(0);
    expect(deps.store.sessions.size).toBe(0);
  });

  it('crea usuario, perfil inicial y sesión; guarda la política aceptada y la contraseña hasheada', async () => {
    const result = await register(input());

    const [user] = [...deps.store.users.values()];
    expect(user).toBeDefined();
    expect(user?.passwordHash).toBe('fake:clave1234');
    expect(user?.policyVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(user?.policyAcceptedAt).toEqual(deps.clock.now());
    expect(user?.emailVerifiedAt).toBeNull();

    const profile = deps.store.profiles.get(user?.id ?? '');
    expect(profile?.onboardingStep).toBe('ai_name');
    expect(profile?.aiMode).toBe('manual');

    const [session] = [...deps.store.sessions.values()];
    expect(session?.userId).toBe(user?.id ?? '');
    expect(session?.deviceId).toBe(DEVICE.id);
    expect(session?.deviceName).toBe(DEVICE.name);

    expect(result.me.id).toBe(user?.id ?? '');
    expect(result.me.profile.onboardingStep).toBe('ai_name');
    expect(result.me.defaultAccount).toBeNull();
    expect(result.tokens.refreshToken.startsWith(`${session?.id}.`)).toBe(true);
  });

  it('si falla una parte, no queda nada creado (una sola transacción)', async () => {
    deps.repositories.profiles.create = async () => {
      throw new Error('falla simulada');
    };
    await expect(register(input())).rejects.toThrow('falla simulada');
    expect(deps.store.users.size).toBe(0);
    expect(deps.store.sessions.size).toBe(0);
  });

  it('la respuesta no expone el hash de la contraseña', async () => {
    const result = await register(input());
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('fake:clave1234');
  });
});
