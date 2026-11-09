import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  type AuthJson,
  bearer,
  loginBody,
  postJson,
  profileBody,
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

const SLOW = 30_000;
const OTHER_DEVICE = { id: '0199a1b2-0000-7000-8000-00000000d002', name: 'Tablet' };
const ACCOUNT_ID = '0199a1b2-0000-7000-8000-00000000a001';

const getMe = (token: string) => t.app.request('/v1/me', { headers: bearer(token) });

/** Un usuario con sesión en dos dispositivos. */
async function twoDevices() {
  const phone = await registerUser(t);
  const res = await postJson(t, '/v1/auth/login', loginBody({ device: OTHER_DEVICE }));
  const tablet = await jsonBody<AuthJson>(res);
  return { phone: phone.tokens, tablet: tablet.tokens };
}

describe('historia 3: configuración', () => {
  it(
    '3.5 cambiar la contraseña cierra la otra sesión de inmediato y la actual sigue',
    async () => {
      const { phone, tablet } = await twoDevices();
      const res = await postJson(
        t,
        '/v1/auth/password/change',
        { currentPassword: 'clave1234', newPassword: 'nueva5678' },
        bearer(phone.accessToken),
      );
      expect(res.status).toBe(204);

      expect((await getMe(phone.accessToken)).status).toBe(200);
      expect((await getMe(tablet.accessToken)).status).toBe(401);
      // la otra sesión tampoco puede renovarse
      const refresh = await postJson(t, '/v1/auth/refresh', { refreshToken: tablet.refreshToken });
      expect(refresh.status).toBe(401);
      // con la contraseña nueva se entra; con la vieja no
      expect(
        (await postJson(t, '/v1/auth/login', loginBody({ password: 'nueva5678' }))).status,
      ).toBe(200);
      expect((await postJson(t, '/v1/auth/login', loginBody())).status).toBe(401);
    },
    SLOW,
  );

  it(
    '3.6 con la contraseña actual incorrecta no cambia nada y no cierra ninguna sesión',
    async () => {
      const { phone, tablet } = await twoDevices();
      const res = await postJson(
        t,
        '/v1/auth/password/change',
        { currentPassword: 'mala1234', newPassword: 'nueva5678' },
        bearer(phone.accessToken),
      );
      expect(res.status).toBe(401);
      expect((await getMe(phone.accessToken)).status).toBe(200);
      expect((await getMe(tablet.accessToken)).status).toBe(200);
    },
    SLOW,
  );

  it('3.3 cambiar la moneda principal no cambia la moneda de "Efectivo"', async () => {
    const { tokens } = await registerUser(t);
    const auth = bearer(tokens.accessToken);
    await putJson(
      t,
      '/v1/me/profile',
      profileBody({
        primaryCurrency: 'COP',
        onboardingStep: 'ai_mode',
        updatedAt: '2026-10-22T12:00:01.000Z',
      }),
      auth,
    );
    await postJson(t, '/v1/me/onboarding/complete', { defaultAccountId: ACCOUNT_ID }, auth);
    await putJson(
      t,
      '/v1/me/profile',
      profileBody({
        primaryCurrency: 'USD',
        onboardingStep: 'done',
        updatedAt: '2026-10-22T12:00:02.000Z',
      }),
      auth,
    );

    const me = await jsonBody<{
      profile: { primaryCurrency: string };
      defaultAccount: { currency: string };
    }>(await getMe(tokens.accessToken));
    expect(me.profile.primaryCurrency).toBe('USD');
    expect(me.defaultAccount.currency).toBe('COP');
  });

  it('3.2 hasta 2 monedas de referencia, distintas de la principal', async () => {
    const { tokens } = await registerUser(t);
    const auth = bearer(tokens.accessToken);

    const two = await putJson(
      t,
      '/v1/me/profile',
      profileBody({
        primaryCurrency: 'COP',
        referenceCurrencies: ['USD', 'EUR'],
        updatedAt: '2026-10-22T12:00:01.000Z',
      }),
      auth,
    );
    expect(two.status).toBe(200);
    expect((await jsonBody<{ referenceCurrencies: string[] }>(two)).referenceCurrencies).toEqual([
      'USD',
      'EUR',
    ]);

    const three = await putJson(
      t,
      '/v1/me/profile',
      profileBody({
        primaryCurrency: 'COP',
        referenceCurrencies: ['USD', 'EUR', 'MXN'],
        updatedAt: '2026-10-22T12:00:02.000Z',
      }),
      auth,
    );
    expect(three.status).toBe(400);
  });

  it('3.1 activar el modo automático exige la confirmación', async () => {
    const { tokens } = await registerUser(t);
    const auth = bearer(tokens.accessToken);
    const without = await putJson(
      t,
      '/v1/me/profile',
      profileBody({ aiMode: 'auto', updatedAt: '2026-10-22T12:00:01.000Z' }),
      auth,
    );
    expect(without.status).toBe(400);
    const confirmed = await putJson(
      t,
      '/v1/me/profile',
      profileBody({
        aiMode: 'auto',
        autoModeConfirmed: true,
        updatedAt: '2026-10-22T12:00:02.000Z',
      }),
      auth,
    );
    expect(confirmed.status).toBe(200);
  });
});
