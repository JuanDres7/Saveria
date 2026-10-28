import { beforeEach, describe, expect, it } from 'bun:test';
import { issueSession } from '../../src/application/use-cases/issue-session';
import { createRefresh } from '../../src/application/use-cases/refresh';
import { DomainError } from '../../src/domain/errors';
import { makeUser } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

let deps: UseCaseDeps;
let refresh: ReturnType<typeof createRefresh>;
let userId: string;

const SEC = 1000;
const DAY = 24 * 60 * 60 * SEC;

beforeEach(async () => {
  deps = createUseCaseDeps();
  refresh = createRefresh(deps);
  const user = makeUser();
  userId = user.id;
  await deps.repositories.users.create(user);
});

async function newSession() {
  const { session, tokens } = await issueSession(deps, deps.repositories.sessions, {
    userId,
    device: { id: '0199a1b2-0000-7000-8000-00000000d001' },
  });
  return { sessionId: session.id, refreshToken: tokens.refreshToken };
}

const stored = (id: string) => deps.store.sessions.get(id);

async function errorOf(promise: Promise<unknown>): Promise<DomainError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DomainError);
  return error as DomainError;
}

describe('issueSession', () => {
  it('crea la sesión con vencimiento a 30 días y guarda solo el SHA-256 del refresh token', async () => {
    const { sessionId, refreshToken } = await newSession();
    const session = stored(sessionId);
    expect(refreshToken).toMatch(new RegExp(`^${sessionId}\\.[A-Za-z0-9_-]{43}$`));
    expect(session?.refreshTokenHash).toBe(deps.random.sha256Hex(refreshToken));
    expect(session?.refreshTokenHash).not.toContain(refreshToken);
    expect(session?.expiresAt.getTime()).toBe(deps.clock.now().getTime() + 30 * DAY);
  });
});

describe('refresh', () => {
  it('rota: el token nuevo sirve y el actual pasa a previous con rotated_at', async () => {
    const { sessionId, refreshToken } = await newSession();
    const oldHash = stored(sessionId)?.refreshTokenHash;

    const pair = await refresh(refreshToken);
    expect(pair.refreshToken).not.toBe(refreshToken);
    expect(await deps.tokens.verifyAccess(pair.accessToken)).toEqual({
      sub: userId,
      sid: sessionId,
    });
    expect(stored(sessionId)?.refreshTokenHash).toBe(deps.random.sha256Hex(pair.refreshToken));
    expect(stored(sessionId)?.previousRefreshTokenHash).toBe(oldHash ?? '');
    expect(stored(sessionId)?.rotatedAt).toEqual(deps.clock.now());

    // el token nuevo también rota
    const next = await refresh(pair.refreshToken);
    expect(next.refreshToken).not.toBe(pair.refreshToken);
  });

  it('el token anterior dentro de los 60 s devuelve un par nuevo (respuesta perdida en la red)', async () => {
    const { sessionId, refreshToken } = await newSession();
    await refresh(refreshToken);
    deps.clock.advance(59 * SEC);

    const retry = await refresh(refreshToken);
    expect(await deps.tokens.verifyAccess(retry.accessToken)).not.toBeNull();
    expect(stored(sessionId)?.revokedAt).toBeNull();
    expect(stored(sessionId)?.refreshTokenHash).toBe(deps.random.sha256Hex(retry.refreshToken));
  });

  it('reintentar en la ventana de gracia no la alarga', async () => {
    const { sessionId, refreshToken } = await newSession();
    await refresh(refreshToken);
    deps.clock.advance(50 * SEC);
    await refresh(refreshToken);
    deps.clock.advance(20 * SEC); // 70 s desde la rotación original
    expect((await errorOf(refresh(refreshToken))).code).toBe('unauthorized');
    expect(stored(sessionId)?.revokeReason).toBe('reuse_detected');
  });

  it('el token anterior después de los 60 s revoca la sesión con reuse_detected', async () => {
    const { sessionId, refreshToken } = await newSession();
    const pair = await refresh(refreshToken);
    deps.clock.advance(61 * SEC);

    expect((await errorOf(refresh(refreshToken))).code).toBe('unauthorized');
    expect(stored(sessionId)?.revokeReason).toBe('reuse_detected');
    // el token vigente también deja de servir
    expect((await errorOf(refresh(pair.refreshToken))).code).toBe('unauthorized');
  });

  it('vencimiento deslizante: expires_at = último uso + 30 días', async () => {
    const { sessionId, refreshToken } = await newSession();
    deps.clock.advance(10 * DAY);
    await refresh(refreshToken);
    expect(stored(sessionId)?.lastUsedAt).toEqual(deps.clock.now());
    expect(stored(sessionId)?.expiresAt.getTime()).toBe(deps.clock.now().getTime() + 30 * DAY);
  });

  it('una sesión vencida responde 401', async () => {
    const { refreshToken } = await newSession();
    deps.clock.advance(30 * DAY + SEC);
    expect((await errorOf(refresh(refreshToken))).code).toBe('unauthorized');
  });

  it('una revocación que llega mientras corre el refresh no se deshace', async () => {
    const { sessionId, refreshToken } = await newSession();
    const sessions = deps.repositories.sessions;
    const findById = sessions.findById.bind(sessions);
    // La recuperación de contraseña revoca la sesión justo después de que el refresh la leyó.
    sessions.findById = async (id) => {
      const session = await findById(id);
      await sessions.revokeAllForUser(userId, 'password_reset', deps.clock.now());
      return session;
    };

    expect((await errorOf(refresh(refreshToken))).code).toBe('unauthorized');
    expect(stored(sessionId)).toMatchObject({ revokeReason: 'password_reset' });
    expect(stored(sessionId)?.revokedAt).not.toBeNull();
  });

  it('dos refresh simultáneos con el mismo token: solo uno rota', async () => {
    const { refreshToken } = await newSession();
    const results = await Promise.allSettled([refresh(refreshToken), refresh(refreshToken)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('una sesión revocada responde 401', async () => {
    const { sessionId, refreshToken } = await newSession();
    await deps.repositories.sessions.revoke(sessionId, 'logout', deps.clock.now());
    expect((await errorOf(refresh(refreshToken))).code).toBe('unauthorized');
  });

  it('con la cuenta borrada responde account_deleted', async () => {
    const { refreshToken } = await newSession();
    await deps.repositories.sessions.markAccountDeleted(userId, deps.clock.now());
    await deps.repositories.users.delete(userId);
    expect((await errorOf(refresh(refreshToken))).code).toBe('account_deleted');
  });

  it('un secreto que no coincide responde 401 sin revocar la sesión (el sid no es secreto)', async () => {
    const { sessionId } = await newSession();
    const forged = `${sessionId}.${'A'.repeat(43)}`;
    expect((await errorOf(refresh(forged))).code).toBe('unauthorized');
    expect(stored(sessionId)?.revokedAt).toBeNull();
  });

  it.each([
    ['vacío', ''],
    ['sin punto', 'abcdefghijklmnopqrstuvwxyz'],
    ['sid inexistente', `0199a1b2-0000-7000-8000-0000000fffff.${'A'.repeat(43)}`],
  ])('un token mal formado o desconocido (%s) responde 401', async (_n, token) => {
    expect((await errorOf(refresh(token))).code).toBe('unauthorized');
  });
});
