import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { SignJWT } from 'jose';
import { requireAuth } from '../../src/interfaces/http/middleware/auth';
import { makeSession, makeUser } from '../support/builders';
import { expectMatchesContract } from '../support/contract';
import { jsonBody } from '../support/http';
import { createTestApp, TEST_JWT_SECRET, type TestApp } from '../support/test-app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
  // Ruta de prueba protegida: las rutas reales llegan con las historias de usuario.
  t.app.get(
    '/_test/protected',
    requireAuth({
      tokens: t.container.tokens,
      sessions: t.container.repositories.sessions,
      clock: t.container.clock,
    }),
    (c) => c.json({ userId: c.get('userId'), sessionId: c.get('sessionId') }),
  );
});
beforeEach(() => t.reset());
afterAll(() => t.close());

/** Crea un usuario con una sesión activa y un access token válido. */
async function signedInUser() {
  const user = makeUser();
  await t.container.repositories.users.create(user);
  const session = makeSession(user.id, {
    expiresAt: new Date(t.clock.now().getTime() + 30 * 24 * 60 * 60 * 1000),
  });
  await t.container.repositories.sessions.create(session);
  const { token } = await t.container.tokens.signAccess({ sub: user.id, sid: session.id });
  return { user, session, token };
}

const get = (token?: string, scheme = 'Bearer') =>
  t.app.request('/_test/protected', {
    headers: token === undefined ? {} : { authorization: `${scheme} ${token}` },
  });

async function expectUnauthorized(res: Response) {
  expect(res.status).toBe(401);
  const body = await jsonBody(res);
  expect(body.code).toBe('unauthorized');
  expectMatchesContract('get', '/v1/me', 401, body);
}

describe('requireAuth', () => {
  it('deja pasar un token válido con una sesión activa y expone usuario y sesión', async () => {
    const { user, session, token } = await signedInUser();
    const res = await get(token);
    expect(res.status).toBe(200);
    expect(await jsonBody<Record<string, string>>(res)).toEqual({
      userId: user.id,
      sessionId: session.id,
    });
  });

  it('sin encabezado Authorization responde 401', async () => {
    await expectUnauthorized(await get());
  });

  it.each([
    ['esquema distinto', 'Basic', 'abc'],
    ['token vacío', 'Bearer', ''],
    ['token con caracteres inválidos', 'Bearer', 'a b;c'],
  ])('un encabezado mal formado (%s) responde 401', async (_name, scheme, value) => {
    await expectUnauthorized(await get(value, scheme));
  });

  it('un token con firma inválida (otro secreto) responde 401', async () => {
    const { user, session } = await signedInUser();
    const forged = await new SignJWT({ sid: session.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setExpirationTime(Math.floor(t.clock.now().getTime() / 1000) + 600)
      .sign(new TextEncoder().encode(`${TEST_JWT_SECRET}-otro`));
    await expectUnauthorized(await get(forged));
  });

  it('un token vencido responde 401', async () => {
    const { token } = await signedInUser();
    t.clock.advance(15 * 60 * 1000 + 1000);
    await expectUnauthorized(await get(token));
  });

  it('una sesión revocada responde 401 de inmediato, aunque el JWT siga vigente', async () => {
    const { session, token } = await signedInUser();
    expect((await get(token)).status).toBe(200);

    await t.container.repositories.sessions.revoke(session.id, 'logout', t.clock.now());

    // el JWT no ha vencido: lo que lo corta es la consulta de la sesión
    await expectUnauthorized(await get(token));
  });

  it('una sesión que ya pasó su expires_at responde 401 aunque el token sea reciente', async () => {
    const user = makeUser();
    await t.container.repositories.users.create(user);
    const session = makeSession(user.id, { expiresAt: new Date(t.clock.now().getTime() - 1000) });
    await t.container.repositories.sessions.create(session);
    const { token } = await t.container.tokens.signAccess({ sub: user.id, sid: session.id });
    await expectUnauthorized(await get(token));
  });

  it('un token cuya sesión no existe responde 401', async () => {
    const { token } = await t.container.tokens.signAccess({
      sub: makeUser().id,
      sid: makeSession(null).id,
    });
    await expectUnauthorized(await get(token));
  });

  it('un token del usuario A con la sesión del usuario B responde 401', async () => {
    const a = makeUser();
    const b = makeUser();
    await t.container.repositories.users.create(a);
    await t.container.repositories.users.create(b);
    const sessionOfB = makeSession(b.id);
    await t.container.repositories.sessions.create(sessionOfB);
    const { token } = await t.container.tokens.signAccess({ sub: a.id, sid: sessionOfB.id });
    await expectUnauthorized(await get(token));
  });

  it('con la cuenta borrada responde 401 account_deleted', async () => {
    const { user, token } = await signedInUser();
    await t.container.uow.run(async (repos) => {
      await repos.sessions.markAccountDeleted(user.id, t.clock.now());
      await repos.users.delete(user.id);
    });

    const res = await get(token);
    expect(res.status).toBe(401);
    const body = await jsonBody(res);
    expect(body.code).toBe('account_deleted');
    expectMatchesContract('get', '/v1/me', 401, body);
  });

  it('account_deleted solo se revela a quien presenta un token firmado: un token falso recibe unauthorized', async () => {
    const { user, token } = await signedInUser();
    await t.container.uow.run(async (repos) => {
      await repos.sessions.markAccountDeleted(user.id, t.clock.now());
      await repos.users.delete(user.id);
    });
    await expectUnauthorized(await get(`${token}x`));
  });

  it('los 401 por causas distintas tienen el mismo cuerpo (no revelan por qué falló)', async () => {
    const { session, token } = await signedInUser();
    await t.container.repositories.sessions.revoke(session.id, 'logout', t.clock.now());

    const revoked = await jsonBody(await get(token));
    const garbage = await jsonBody(await get('basura'));
    const missing = await jsonBody(await get());
    expect(revoked).toEqual(garbage);
    expect(garbage).toEqual(missing);
  });
});
