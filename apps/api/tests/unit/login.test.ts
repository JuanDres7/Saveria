import { beforeEach, describe, expect, it } from 'bun:test';
import { createLogin, type LoginInput } from '../../src/application/use-cases/login';
import { DomainError } from '../../src/domain/errors';
import { makeProfile, makeSession, makeUser } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

let deps: UseCaseDeps;
let login: ReturnType<typeof createLogin>;

const DEVICE = { id: '0199a1b2-0000-7000-8000-00000000d001', name: 'Pixel 8' };
const IP = '203.0.113.10';
const MIN = 60 * 1000;

beforeEach(async () => {
  deps = createUseCaseDeps();
  login = createLogin(deps);
  const user = makeUser({ email: 'ana@mail.com', passwordHash: 'fake:clave1234' });
  await deps.repositories.users.create(user);
  await deps.repositories.profiles.create(makeProfile(user.id));
});

const input = (overrides: Partial<LoginInput> = {}): LoginInput => ({
  email: 'ana@mail.com',
  password: 'clave1234',
  device: DEVICE,
  ip: IP,
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

async function failTimes(n: number, overrides: Partial<LoginInput> = {}) {
  for (let i = 0; i < n; i += 1) {
    expect((await errorOf(login(input({ password: 'mala1234', ...overrides })))).code).toBe(
      'invalid_credentials',
    );
  }
}

describe('login', () => {
  it('con credenciales correctas devuelve tokens y el usuario', async () => {
    const result = await login(input({ email: '  ANA@mail.com ' }));
    expect(result.tokens.accessToken).toBeString();
    expect(result.tokens.refreshToken).toBeString();
    expect(result.me.email).toBe('ana@mail.com');
    expect(await deps.tokens.verifyAccess(result.tokens.accessToken)).not.toBeNull();
  });

  it('contraseña mala y correo inexistente dan el mismo error genérico', async () => {
    const wrongPassword = await errorOf(login(input({ password: 'mala1234' })));
    const unknownEmail = await errorOf(login(input({ email: 'nadie@mail.com' })));
    expect(wrongPassword.code).toBe('invalid_credentials');
    expect(unknownEmail.code).toBe('invalid_credentials');
    expect(unknownEmail.message).toBe(wrongPassword.message);
  });

  it('con un correo inexistente igual verifica contra el hash ficticio (mismo tiempo)', async () => {
    await errorOf(login(input({ email: 'nadie@mail.com' })));
    expect(deps.hasher.dummyCalls).toBe(1);
  });

  it('tras 5 fallos de la misma IP al mismo correo responde too_many_attempts, aun con la contraseña correcta', async () => {
    await failTimes(5);
    const blocked = await errorOf(login(input()));
    expect(blocked.code).toBe('too_many_attempts');
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(15 * 60);
  });

  it('el bloqueo vence a los 15 minutos', async () => {
    await failTimes(5);
    deps.clock.advance(15 * MIN + 1000);
    expect((await login(input())).me.email).toBe('ana@mail.com');
  });

  it('el mismo correo desde otra IP sí puede entrar', async () => {
    await failTimes(5);
    expect((await login(input({ ip: '198.51.100.7' }))).me.email).toBe('ana@mail.com');
  });

  it('100 fallos desde una IP (con correos distintos) bloquean esa IP para cualquier correo', async () => {
    for (let i = 0; i < 100; i += 1) {
      await errorOf(login(input({ email: `otro${i}@mail.com` })));
    }
    const blocked = await errorOf(login(input()));
    expect(blocked.code).toBe('too_many_attempts');
    // otra IP no está afectada
    expect((await login(input({ ip: '198.51.100.7' }))).me.email).toBe('ana@mail.com');
  });

  it('un login exitoso reinicia el contador de ese correo', async () => {
    await failTimes(4);
    await login(input());
    await failTimes(4);
    expect((await login(input())).me.email).toBe('ana@mail.com');
  });

  it('un login exitoso no reinicia el contador general de la IP', async () => {
    for (let i = 0; i < 99; i += 1) {
      await errorOf(login(input({ email: `otro${i}@mail.com` })));
    }
    await login(input());
    await errorOf(login(input({ email: 'otro-mas@mail.com' })));
    expect((await errorOf(login(input()))).code).toBe('too_many_attempts');
  });

  it('20 intentos en paralelo no se saltan el límite de 5 fallos por correo', async () => {
    // bcrypt tarda: mientras verifica, llegan los demás intentos.
    const verify = deps.hasher.verify.bind(deps.hasher);
    deps.hasher.verify = async (password, hash) => {
      await Bun.sleep(5);
      return verify(password, hash);
    };
    const codes = await Promise.all(
      Array.from(
        { length: 20 },
        async () => (await errorOf(login(input({ password: 'mala1234' })))).code,
      ),
    );
    expect(codes.filter((code) => code === 'invalid_credentials')).toHaveLength(5);
    expect(codes.filter((code) => code === 'too_many_attempts')).toHaveLength(15);
  });

  it('los intentos bloqueados no alargan el bloqueo ni cuentan como fallos', async () => {
    await failTimes(5);
    for (let i = 0; i < 10; i += 1) await errorOf(login(input()));
    deps.clock.advance(15 * MIN + 1000);
    // ventana nueva: vuelven a quedar 5 intentos
    await failTimes(5);
    expect((await errorOf(login(input()))).code).toBe('too_many_attempts');
  });

  it('un error inesperado no cuenta como fallo', async () => {
    const findByEmail = deps.repositories.users.findByEmail.bind(deps.repositories.users);
    deps.repositories.users.findByEmail = async () => {
      throw new Error('base caída');
    };
    for (let i = 0; i < 6; i += 1) {
      await login(input()).catch(() => undefined);
    }
    deps.repositories.users.findByEmail = findByEmail;
    expect((await login(input())).me.email).toBe('ana@mail.com');
  });

  it('un intento bloqueado no verifica la contraseña', async () => {
    await failTimes(5);
    let verified = false;
    deps.hasher.verify = async () => {
      verified = true;
      return true;
    };
    await errorOf(login(input()));
    expect(verified).toBe(false);
  });

  it('entrar desde el mismo dispositivo revoca la sesión anterior con replaced', async () => {
    const first = await login(input());
    const firstClaims = await deps.tokens.verifyAccess(first.tokens.accessToken);
    await login(input());

    const old = deps.store.sessions.get(firstClaims?.sid ?? '');
    expect(old?.revokedAt).not.toBeNull();
    expect(old?.revokeReason).toBe('replaced');
    const active = [...deps.store.sessions.values()].filter((s) => s.revokedAt === null);
    expect(active).toHaveLength(1);
  });

  it('entrar desde otro dispositivo no toca las demás sesiones', async () => {
    const user = await deps.repositories.users.findByEmail('ana@mail.com');
    const other = makeSession(user?.id ?? null);
    await deps.repositories.sessions.create(other);
    await login(input());
    expect(deps.store.sessions.get(other.id)?.revokedAt).toBeNull();
  });
});
