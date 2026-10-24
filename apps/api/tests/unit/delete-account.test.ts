import { beforeEach, describe, expect, it } from 'bun:test';
import type { UnitOfWork } from '../../src/application/ports/repositories';
import {
  createDeleteAccount,
  type DeleteAccountInput,
} from '../../src/application/use-cases/delete-account';
import { DomainError } from '../../src/domain/errors';
import { makeAccount, makeProfile, makeSession, makeToken, makeUser } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

let deps: UseCaseDeps;
let deleteAccount: ReturnType<typeof createDeleteAccount>;
let userId: string;
let currentSession: string;
let otherSession: string;

const IP = '203.0.113.10';

beforeEach(async () => {
  deps = createUseCaseDeps();
  deleteAccount = createDeleteAccount(deps);
  const user = makeUser({ passwordHash: 'fake:clave1234' });
  userId = user.id;
  await deps.repositories.users.create(user);
  await deps.repositories.profiles.create(makeProfile(userId));
  await deps.repositories.accounts.create(makeAccount(userId));
  await deps.repositories.oneTimeTokens.create(makeToken(userId));
  const current = makeSession(userId, { deviceName: 'Pixel 8' });
  const other = makeSession(userId, { deviceName: 'Tablet' });
  currentSession = current.id;
  otherSession = other.id;
  await deps.repositories.sessions.create(current);
  await deps.repositories.sessions.create(other);
});

const input = (overrides: Partial<DeleteAccountInput> = {}): DeleteAccountInput => ({
  userId,
  ip: IP,
  password: 'clave1234',
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
const userData = () => ({
  user: deps.store.users.get(userId),
  profile: deps.store.profiles.get(userId),
  accounts: [...deps.store.accounts.values()].filter((a) => a.userId === userId),
  tokens: [...deps.store.tokens.values()].filter((t) => t.userId === userId),
});

describe('deleteAccount', () => {
  it('con la contraseña correcta borra el usuario, su perfil, sus cuentas y sus enlaces', async () => {
    await deleteAccount(input());

    const data = userData();
    expect(data.user).toBeUndefined();
    expect(data.profile).toBeUndefined();
    expect(data.accounts).toHaveLength(0);
    expect(data.tokens).toHaveLength(0);
  });

  it('marca TODAS las sesiones como account_deleted, sin nombre de dispositivo ni usuario', async () => {
    await deleteAccount(input());

    for (const id of [currentSession, otherSession]) {
      const s = session(id);
      expect(s?.revokedAt).toEqual(deps.clock.now());
      expect(s?.revokeReason).toBe('account_deleted');
      expect(s?.deviceName).toBeNull();
      expect(s?.userId).toBeNull();
    }
  });

  it('las sesiones ya revocadas también quedan como account_deleted', async () => {
    const old = makeSession(userId, {
      revokedAt: new Date('2026-10-01T00:00:00Z'),
      revokeReason: 'logout',
    });
    await deps.repositories.sessions.create(old);

    await deleteAccount(input());
    expect(session(old.id)?.revokeReason).toBe('account_deleted');
  });

  it('marca las sesiones y borra el usuario en una sola transacción', async () => {
    const calls: string[] = [];
    const uow: UnitOfWork = {
      run: async (work) => {
        calls.push('begin');
        const result = await deps.uow.run(work);
        calls.push('commit');
        return result;
      },
    };
    const sessions = deps.repositories.sessions;
    const users = deps.repositories.users;
    const markAccountDeleted = sessions.markAccountDeleted.bind(sessions);
    const deleteUser = users.delete.bind(users);
    sessions.markAccountDeleted = async (...args) => {
      calls.push('sessions');
      return markAccountDeleted(...args);
    };
    users.delete = async (...args) => {
      calls.push('users');
      return deleteUser(...args);
    };

    await createDeleteAccount({ ...deps, uow })(input());
    expect(calls).toEqual(['begin', 'sessions', 'users', 'commit']);
  });

  it('con la contraseña incorrecta → invalid_credentials y no borra nada', async () => {
    const error = await errorOf(deleteAccount(input({ password: 'mala1234' })));
    expect(error.code).toBe('invalid_credentials');

    const data = userData();
    expect(data.user).toBeDefined();
    expect(data.profile).toBeDefined();
    expect(data.accounts).toHaveLength(1);
    expect(session(currentSession)?.revokedAt).toBeNull();
    expect(session(otherSession)?.revokedAt).toBeNull();
  });

  it('tras 5 contraseñas incorrectas responde too_many_attempts, aun con la correcta', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await errorOf(deleteAccount(input({ password: 'mala1234' })))).code).toBe(
        'invalid_credentials',
      );
    }
    const blocked = await errorOf(deleteAccount(input()));
    expect(blocked.code).toBe('too_many_attempts');
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(userData().user).toBeDefined();
  });

  it('comparte el límite rl:pwd con el cambio de contraseña (misma clave)', async () => {
    for (let i = 0; i < 5; i += 1) {
      await deps.rateLimiter.hit(`rl:pwd:${userId}:${IP}`, 5, 15 * 60);
    }
    expect((await errorOf(deleteAccount(input()))).code).toBe('too_many_attempts');
    // desde otra IP sí se puede
    await deleteAccount(input({ ip: '198.51.100.7' }));
    expect(userData().user).toBeUndefined();
  });

  it('un usuario que ya no existe → unauthorized', async () => {
    await deleteAccount(input());
    expect((await errorOf(deleteAccount(input()))).code).toBe('unauthorized');
  });
});
