import { beforeEach, describe, expect, it } from 'bun:test';
import {
  type ChangePasswordInput,
  createChangePassword,
} from '../../src/application/use-cases/change-password';
import { DomainError } from '../../src/domain/errors';
import { makeSession, makeUser } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

let deps: UseCaseDeps;
let changePassword: ReturnType<typeof createChangePassword>;
let userId: string;
let currentSession: string;
let otherSession: string;

const IP = '203.0.113.10';

beforeEach(async () => {
  deps = createUseCaseDeps();
  changePassword = createChangePassword(deps);
  const user = makeUser({ passwordHash: 'fake:clave1234' });
  userId = user.id;
  await deps.repositories.users.create(user);
  const current = makeSession(userId);
  const other = makeSession(userId);
  currentSession = current.id;
  otherSession = other.id;
  await deps.repositories.sessions.create(current);
  await deps.repositories.sessions.create(other);
});

const input = (overrides: Partial<ChangePasswordInput> = {}): ChangePasswordInput => ({
  userId,
  sessionId: currentSession,
  ip: IP,
  currentPassword: 'clave1234',
  newPassword: 'nueva5678',
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

const session = (id: string) => deps.store.sessions.get(id);

describe('changePassword', () => {
  it('con la contraseña actual correcta cambia el hash, cierra las demás sesiones y mantiene la actual', async () => {
    await changePassword(input());

    expect(deps.store.users.get(userId)?.passwordHash).toBe('fake:nueva5678');
    expect(session(otherSession)?.revokedAt).not.toBeNull();
    expect(session(otherSession)?.revokeReason).toBe('password_changed');
    expect(session(currentSession)?.revokedAt).toBeNull();
  });

  it('con la contraseña actual incorrecta → invalid_credentials y no cierra ninguna sesión', async () => {
    const error = await errorOf(changePassword(input({ currentPassword: 'mala1234' })));
    expect(error.code).toBe('invalid_credentials');
    expect(deps.store.users.get(userId)?.passwordHash).toBe('fake:clave1234');
    expect(session(otherSession)?.revokedAt).toBeNull();
    expect(session(currentSession)?.revokedAt).toBeNull();
  });

  it.each([
    ['corta', 'abc12'],
    ['sin número', 'clavelarga'],
    ['sin letra', '12345678'],
  ])(
    'una contraseña nueva inválida (%s) → validation_error en newPassword',
    async (_n, newPassword) => {
      const error = await errorOf(changePassword(input({ newPassword })));
      expect(error.code).toBe('validation_error');
      expect(error.fields?.newPassword).toBeDefined();
      expect(deps.store.users.get(userId)?.passwordHash).toBe('fake:clave1234');
    },
  );

  it('tras 5 contraseñas actuales incorrectas responde too_many_attempts, aun con la correcta', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await errorOf(changePassword(input({ currentPassword: 'mala1234' })))).code).toBe(
        'invalid_credentials',
      );
    }
    const blocked = await errorOf(changePassword(input()));
    expect(blocked.code).toBe('too_many_attempts');
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(deps.store.users.get(userId)?.passwordHash).toBe('fake:clave1234');
  });

  it('10 intentos en paralelo no se saltan el límite de 5 fallos', async () => {
    // bcrypt tarda: mientras verifica, llegan los demás intentos.
    const verify = deps.hasher.verify.bind(deps.hasher);
    deps.hasher.verify = async (password, hash) => {
      await Bun.sleep(5);
      return verify(password, hash);
    };
    const codes = await Promise.all(
      Array.from(
        { length: 10 },
        async () => (await errorOf(changePassword(input({ currentPassword: 'mala1234' })))).code,
      ),
    );
    expect(codes.filter((code) => code === 'invalid_credentials')).toHaveLength(5);
    expect(codes.filter((code) => code === 'too_many_attempts')).toHaveLength(5);
  });

  it('el límite es por usuario e IP (clave rl:pwd:{userId}:{ip})', async () => {
    for (let i = 0; i < 5; i += 1) {
      await errorOf(changePassword(input({ currentPassword: 'mala1234' })));
    }
    // desde otra IP el mismo usuario puede intentarlo
    await changePassword(input({ ip: '198.51.100.7' }));
    expect(deps.store.users.get(userId)?.passwordHash).toBe('fake:nueva5678');
  });

  it('el bloqueo vence a los 15 minutos', async () => {
    for (let i = 0; i < 5; i += 1) {
      await errorOf(changePassword(input({ currentPassword: 'mala1234' })));
    }
    deps.clock.advance(15 * 60 * 1000 + 1000);
    await changePassword(input());
    expect(deps.store.users.get(userId)?.passwordHash).toBe('fake:nueva5678');
  });

  it('un cambio exitoso reinicia el contador', async () => {
    for (let i = 0; i < 4; i += 1) {
      await errorOf(changePassword(input({ currentPassword: 'mala1234' })));
    }
    await changePassword(input());
    for (let i = 0; i < 4; i += 1) {
      await errorOf(changePassword(input({ currentPassword: 'mala1234' })));
    }
    await changePassword(input({ currentPassword: 'nueva5678', newPassword: 'otra9999' }));
    expect(deps.store.users.get(userId)?.passwordHash).toBe('fake:otra9999');
  });
});
