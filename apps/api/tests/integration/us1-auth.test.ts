import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  type AuthJson,
  bearer,
  loginBody,
  postJson,
  registerBody,
  registerUser,
} from '../support/auth-http';
import { jsonBody } from '../support/http';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(() => t.reset());
afterAll(() => t.close());

const SLOW = 30_000;

const getMe = (accessToken: string) => t.app.request('/v1/me', { headers: bearer(accessToken) });

describe('historia 1: crear una cuenta y entrar', () => {
  it('1.1 registrarse deja la sesión iniciada: GET /v1/me responde con el usuario nuevo', async () => {
    const { tokens, me } = await registerUser(t, { email: ' Ana@Mail.com ' });
    const res = await getMe(tokens.accessToken);
    expect(res.status).toBe(200);
    const body = await jsonBody<AuthJson['me']>(res);
    expect(body.id).toBe(me.id);
    expect(body.email).toBe('ana@mail.com');
    expect(body.profile.onboardingStep).toBe('ai_name');
  });

  it('1.2 sin aceptar la política no se crea la cuenta', async () => {
    const res = await postJson(t, '/v1/auth/register', registerBody({ policyAccepted: false }));
    expect(res.status).toBe(422);
    const login = await postJson(t, '/v1/auth/login', loginBody());
    expect(login.status).toBe(401);
  });

  it('1.3 un correo ya registrado se rechaza sin revelar nada de la cuenta', async () => {
    await registerUser(t);
    const res = await postJson(t, '/v1/auth/register', registerBody({ password: 'otraclave99' }));
    expect(res.status).toBe(409);
    const body = await jsonBody(res);
    expect(body.message).not.toContain('ana@mail.com');
    expect(body.message.toLowerCase()).not.toContain('existe');
  });

  it(
    '1.4 con las credenciales correctas entra y ve sus datos',
    async () => {
      const { me } = await registerUser(t);
      const res = await postJson(t, '/v1/auth/login', loginBody());
      expect(res.status).toBe(200);
      const { tokens } = await jsonBody<AuthJson>(res);
      const meRes = await getMe(tokens.accessToken);
      expect((await jsonBody<AuthJson['me']>(meRes)).id).toBe(me.id);
    },
    SLOW,
  );

  it(
    '1.5 contraseña mala y correo inexistente reciben exactamente la misma respuesta',
    async () => {
      await registerUser(t);
      const wrong = await postJson(t, '/v1/auth/login', loginBody({ password: 'mala1234' }));
      const unknown = await postJson(t, '/v1/auth/login', loginBody({ email: 'nadie@mail.com' }));
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(await jsonBody(wrong)).toEqual(await jsonBody(unknown));
    },
    SLOW,
  );

  it('1.6 cerrar sesión corta el acceso de inmediato, aunque el access token no haya vencido', async () => {
    const { tokens } = await registerUser(t);
    expect((await getMe(tokens.accessToken)).status).toBe(200);

    const logout = await t.app.request('/v1/auth/logout', {
      method: 'POST',
      headers: bearer(tokens.accessToken),
    });
    expect(logout.status).toBe(204);

    expect((await getMe(tokens.accessToken)).status).toBe(401);
    // el refresh token de esa sesión tampoco sirve
    const refresh = await postJson(t, '/v1/auth/refresh', { refreshToken: tokens.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('1.7 cerrar sesión solo con el refreshToken (logout hecho sin conexión) revoca la sesión', async () => {
    const { tokens } = await registerUser(t);
    const logout = await postJson(t, '/v1/auth/logout', { refreshToken: tokens.refreshToken });
    expect(logout.status).toBe(204);
    expect((await getMe(tokens.accessToken)).status).toBe(401);
  });

  it('logout con el refresh token anterior (ya rotado) también revoca la sesión', async () => {
    const { tokens } = await registerUser(t);
    const rotated = await jsonBody<AuthJson['tokens']>(
      await postJson(t, '/v1/auth/refresh', { refreshToken: tokens.refreshToken }),
    );
    await postJson(t, '/v1/auth/logout', { refreshToken: tokens.refreshToken });
    expect((await getMe(rotated.accessToken)).status).toBe(401);
  });

  it('logout con un access token ajeno o vencido usa el refreshToken del cuerpo', async () => {
    const { tokens } = await registerUser(t);
    t.clock.advance(16 * 60 * 1000); // el access token ya venció
    const logout = await postJson(
      t,
      '/v1/auth/logout',
      { refreshToken: tokens.refreshToken },
      bearer(tokens.accessToken),
    );
    expect(logout.status).toBe(204);
    const refresh = await postJson(t, '/v1/auth/refresh', { refreshToken: tokens.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('renovar los tokens mantiene la sesión: el access token nuevo funciona', async () => {
    const { tokens } = await registerUser(t);
    t.clock.advance(16 * 60 * 1000);
    expect((await getMe(tokens.accessToken)).status).toBe(401);

    const res = await postJson(t, '/v1/auth/refresh', { refreshToken: tokens.refreshToken });
    expect(res.status).toBe(200);
    const pair = await jsonBody<AuthJson['tokens']>(res);
    expect((await getMe(pair.accessToken)).status).toBe(200);
  });

  it('los registros del servidor no contienen la contraseña ni los tokens', async () => {
    const { tokens } = await registerUser(t);
    await postJson(t, '/v1/auth/refresh', { refreshToken: tokens.refreshToken });
    const logs = t.logLines.join('\n');
    expect(logs).not.toContain('clave1234');
    expect(logs).not.toContain(tokens.refreshToken);
    expect(logs).not.toContain(tokens.accessToken);
  });
});
