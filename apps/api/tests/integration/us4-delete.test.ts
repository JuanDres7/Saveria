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
import { expectMatchesContract } from '../support/contract';
import { createTestDb } from '../support/db';
import { jsonBody } from '../support/http';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;
let db: ReturnType<typeof createTestDb>;

beforeAll(async () => {
  t = await createTestApp();
  db = createTestDb();
});
beforeEach(() => t.reset());
afterAll(async () => {
  await db.client.end();
  await t.close();
});

// bcrypt real (costo 12) en cada intento
const SLOW = 30_000;
const PATH = '/v1/me';
const OTHER_DEVICE = { id: '0199a1b2-0000-7000-8000-00000000d002', name: 'Tablet' };
const ACCOUNT_ID = '0199a1b2-0000-7000-8000-00000000a001';

const deleteMe = (body: unknown, headers: Record<string, string>) =>
  t.app.request(PATH, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const getMe = (token: string) => t.app.request(PATH, { headers: bearer(token) });

async function expectContract(res: Response, status: number) {
  expect(res.status).toBe(status);
  const body = status === 204 ? undefined : await jsonBody<Record<string, unknown>>(res);
  expectMatchesContract('delete', PATH, status, body);
  return body;
}

/** Usuario con el onboarding terminado ("Efectivo" creada) y sesión en dos dispositivos. */
async function userWithData() {
  const phone = await registerUser(t);
  const auth = bearer(phone.tokens.accessToken);
  await putJson(
    t,
    '/v1/me/profile',
    profileBody({ primaryCurrency: 'COP', onboardingStep: 'ai_mode' }),
    auth,
  );
  await postJson(t, '/v1/me/onboarding/complete', { defaultAccountId: ACCOUNT_ID }, auth);
  const tablet = await jsonBody<AuthJson>(
    await postJson(t, '/v1/auth/login', loginBody({ device: OTHER_DEVICE })),
  );
  return { userId: phone.me.id, phone: phone.tokens, tablet: tablet.tokens };
}

async function rowsOf(userId: string) {
  const [counts] = await db.client`
    SELECT
      (SELECT count(*)::int FROM users WHERE id = ${userId}) AS users,
      (SELECT count(*)::int FROM user_profiles WHERE id = ${userId}) AS profiles,
      (SELECT count(*)::int FROM accounts WHERE user_id = ${userId}) AS accounts,
      (SELECT count(*)::int FROM one_time_tokens WHERE user_id = ${userId}) AS tokens,
      (SELECT count(*)::int FROM sessions WHERE user_id = ${userId}) AS sessions`;
  return counts;
}

describe('contrato: DELETE /v1/me', () => {
  it(
    '204 con la contraseña correcta',
    async () => {
      const { tokens } = await registerUser(t);
      await expectContract(
        await deleteMe({ password: 'clave1234' }, bearer(tokens.accessToken)),
        204,
      );
    },
    SLOW,
  );

  it(
    '401 invalid_credentials con la contraseña incorrecta',
    async () => {
      const { tokens } = await registerUser(t);
      const body = await expectContract(
        await deleteMe({ password: 'mala1234' }, bearer(tokens.accessToken)),
        401,
      );
      expect(body?.code).toBe('invalid_credentials');
    },
    SLOW,
  );

  it('400 validation_error sin contraseña', async () => {
    const { tokens } = await registerUser(t);
    const body = await expectContract(
      await deleteMe({ password: '' }, bearer(tokens.accessToken)),
      400,
    );
    expect(body?.code).toBe('validation_error');
  });

  it('401 unauthorized sin token', async () => {
    const body = await expectContract(await deleteMe({ password: 'clave1234' }, {}), 401);
    expect(body?.code).toBe('unauthorized');
  });

  it(
    '429 con Retry-After tras 5 contraseñas incorrectas',
    async () => {
      const { tokens } = await registerUser(t);
      const auth = bearer(tokens.accessToken);
      for (let i = 0; i < 5; i += 1) await deleteMe({ password: 'mala1234' }, auth);

      const res = await deleteMe({ password: 'clave1234' }, auth);
      expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
      const body = await expectContract(res, 429);
      expect(body?.code).toBe('too_many_attempts');
    },
    SLOW,
  );
});

describe('historia 4: borrar la cuenta', () => {
  it(
    '4.2 tras borrar, no quedan datos del usuario y sus credenciales ya no sirven',
    async () => {
      const { userId, phone } = await userWithData();
      expect(await rowsOf(userId)).toMatchObject({ users: 1, profiles: 1, accounts: 1 });

      const res = await deleteMe({ password: 'clave1234' }, bearer(phone.accessToken));
      expect(res.status).toBe(204);

      expect(await rowsOf(userId)).toEqual({
        users: 0,
        profiles: 0,
        accounts: 0,
        tokens: 0,
        sessions: 0,
      });
      const login = await postJson(t, '/v1/auth/login', loginBody());
      expect(login.status).toBe(401);
      expect((await jsonBody(login)).code).toBe('invalid_credentials');
    },
    SLOW,
  );

  it(
    '4.2 las sesiones quedan revocadas como account_deleted, sin datos personales',
    async () => {
      const { phone } = await userWithData();
      await deleteMe({ password: 'clave1234' }, bearer(phone.accessToken));

      const sessions = await db.client`
        SELECT user_id, device_name, revoked_at, revoke_reason FROM sessions`;
      expect(sessions).toHaveLength(2);
      for (const s of sessions) {
        expect(s.user_id).toBeNull();
        expect(s.device_name).toBeNull();
        expect(s.revoked_at).not.toBeNull();
        expect(s.revoke_reason).toBe('account_deleted');
      }
    },
    SLOW,
  );

  it(
    '4.2 en otro dispositivo, el middleware y el refresh responden 401 account_deleted',
    async () => {
      const { phone, tablet } = await userWithData();
      await deleteMe({ password: 'clave1234' }, bearer(phone.accessToken));

      for (const tokens of [phone, tablet]) {
        const me = await getMe(tokens.accessToken);
        expect(me.status).toBe(401);
        expect((await jsonBody(me)).code).toBe('account_deleted');

        const refresh = await postJson(t, '/v1/auth/refresh', {
          refreshToken: tokens.refreshToken,
        });
        expect(refresh.status).toBe(401);
        const body = await jsonBody(refresh);
        expect(body.code).toBe('account_deleted');
        expectMatchesContract('post', '/v1/auth/refresh', 401, body);
      }
    },
    SLOW,
  );

  it(
    '4.3 registrarse otra vez con el mismo correo da una cuenta nueva y vacía',
    async () => {
      const { userId, phone } = await userWithData();
      await deleteMe({ password: 'clave1234' }, bearer(phone.accessToken));

      const again = await registerUser(t);
      expect(again.me.id).not.toBe(userId);
      expect(again.me.profile.onboardingStep).toBe('ai_name');
      const me = await jsonBody<{ defaultAccount: unknown; profile: Record<string, unknown> }>(
        await getMe(again.tokens.accessToken),
      );
      expect(me.defaultAccount).toBeNull();
      expect(me.profile.primaryCurrency).toBeNull();
    },
    SLOW,
  );

  it(
    'con la contraseña incorrecta no se borra nada y ninguna sesión se cierra',
    async () => {
      const { userId, phone, tablet } = await userWithData();
      const res = await deleteMe({ password: 'mala1234' }, bearer(phone.accessToken));
      expect(res.status).toBe(401);

      expect(await rowsOf(userId)).toMatchObject({ users: 1, profiles: 1, accounts: 1 });
      expect((await getMe(phone.accessToken)).status).toBe(200);
      expect((await getMe(tablet.accessToken)).status).toBe(200);
    },
    SLOW,
  );
});
