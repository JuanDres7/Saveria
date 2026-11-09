import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  type AuthJson,
  bearer,
  deleteJson,
  loginBody,
  onboardUser,
  postJson,
  putJson,
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

  it(
    'FR-040 al guardar y borrar cuentas y movimientos no aparecen montos ni descripciones',
    async () => {
      const user = await onboardUser(t);
      const nequi = crypto.randomUUID();
      const tx = crypto.randomUUID();
      // Valores poco comunes para que no choquen con horas ni duraciones del registro.
      const SECRET_BALANCE = '80123';
      const SECRET_AMOUNT = '187654';
      const SECRET_NAME = 'Cuenta de Carlos Alberto';
      const SECRET_NOTE = 'cena con Carlos Alberto';

      await putJson(
        t,
        `/v1/accounts/${nequi}`,
        {
          name: SECRET_NAME,
          type: 'wallet',
          currency: 'COP',
          initialBalance: SECRET_BALANCE,
          isDefault: false,
          archivedAt: null,
          updatedAt: '2026-10-22T12:00:05.000Z',
        },
        user.headers,
      );
      const body = {
        type: 'expense',
        accountId: nequi,
        amount: SECRET_AMOUNT,
        currency: 'COP',
        toAccountId: null,
        toAmount: null,
        toCurrency: null,
        categorySlug: 'dining',
        description: SECRET_NOTE,
        occurredOn: '2026-10-22',
        deletedAt: null,
        updatedAt: '2026-10-22T12:00:06.000Z',
      };
      await putJson(t, `/v1/transactions/${tx}`, body, user.headers);
      // Un envío rechazado y uno viejo (409) también pasan por el registro.
      await putJson(t, `/v1/transactions/${tx}`, { ...body, amount: '0' }, user.headers);
      await putJson(
        t,
        `/v1/transactions/${tx}`,
        { ...body, updatedAt: '2026-10-22T12:00:01.000Z' },
        user.headers,
      );
      await deleteJson(
        t,
        `/v1/transactions/${tx}`,
        { updatedAt: '2026-10-22T12:00:09.000Z' },
        user.headers,
      );

      const logs = t.logLines.join('\n');
      expect(logs).toContain('/v1/transactions/');
      expect(logs).toContain('/v1/accounts/');
      for (const secret of [SECRET_BALANCE, SECRET_AMOUNT, SECRET_NAME, SECRET_NOTE, 'Carlos']) {
        expect(logs).not.toContain(secret);
      }
    },
    SLOW,
  );
});
