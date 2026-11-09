import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { type AuthJson, bearer, loginBody, postJson, registerUser } from '../support/auth-http';
import { jsonBody } from '../support/http';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(() => t.reset());
afterAll(() => t.close());

// bcrypt real (costo 12) en varios pasos
const SLOW = 60_000;
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

describe('SC-006: los logs no contienen secretos', () => {
  it(
    'en registro, login, refresh, verificación, recuperación y errores no aparecen contraseñas, tokens ni correos',
    async () => {
      const secrets: string[] = ['clave1234', 'nueva5678', 'mala-1234', 'ana@mail.com'];

      // registro y verificación del correo
      const registered = await registerUser(t);
      secrets.push(registered.tokens.accessToken, registered.tokens.refreshToken);
      const verifyToken = t.emails.lastTokenTo('ana@mail.com') as string;
      secrets.push(verifyToken);
      await t.app.request(`/links/verify-email?token=${verifyToken}`);
      await t.app.request('/links/verify-email', {
        method: 'POST',
        headers: FORM,
        body: new URLSearchParams({ token: verifyToken }).toString(),
      });

      // login fallido y correcto, uso del access token y refresh
      await postJson(t, '/v1/auth/login', loginBody({ password: 'mala-1234' }));
      const login = await jsonBody<AuthJson>(await postJson(t, '/v1/auth/login', loginBody()));
      secrets.push(login.tokens.accessToken, login.tokens.refreshToken);
      await t.app.request('/v1/me', { headers: bearer(login.tokens.accessToken) });
      const refreshed = await jsonBody<AuthJson['tokens']>(
        await postJson(t, '/v1/auth/refresh', { refreshToken: login.tokens.refreshToken }),
      );
      secrets.push(refreshed.accessToken, refreshed.refreshToken);

      // un error de validación que trae la contraseña en el cuerpo
      await postJson(t, '/v1/auth/register', { email: 'x', password: 'clave1234' });

      // recuperación de contraseña
      await postJson(t, '/v1/auth/password/forgot', { email: 'ana@mail.com' });
      const resetToken = t.emails.lastTokenTo('ana@mail.com') as string;
      secrets.push(resetToken);
      await t.app.request(`/links/reset-password?token=${resetToken}`);
      await t.app.request('/links/reset-password', {
        method: 'POST',
        headers: FORM,
        body: new URLSearchParams({
          token: resetToken,
          password: 'nueva5678',
          passwordConfirmation: 'nueva5678',
        }).toString(),
      });

      const logs = t.logLines.join('\n');
      // hubo un log por cada una de las 11 peticiones
      expect(t.logLines.length).toBeGreaterThanOrEqual(11);
      expect(logs).toContain('/links/reset-password');

      for (const secret of secrets) expect(logs).not.toContain(secret);
      expect(logs).not.toMatch(/Bearer/i);
      expect(logs).not.toContain('token=');
    },
    SLOW,
  );
});
