import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { bearer, postJson, profileBody, putJson, registerUser } from '../support/auth-http';
import { jsonBody } from '../support/http';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(() => t.reset());
afterAll(() => t.close());

const B_ACCOUNT = '0199a1b2-0000-7000-8000-00000000b001';
const DEVICE_B = { id: '0199a1b2-0000-7000-8000-00000000d00b', name: 'Teléfono de B' };

type MeJson = {
  id: string;
  email: string;
  profile: { city: string | null; primaryCurrency: string | null; onboardingStep: string };
  defaultAccount: { id: string; currency: string } | null;
};

const getMe = async (token: string) =>
  jsonBody<MeJson>(await t.app.request('/v1/me', { headers: bearer(token) }));

/** A recién registrado; B con el onboarding terminado y su cuenta "Efectivo" en COP. */
async function twoUsers() {
  const a = await registerUser(t);
  const b = await registerUser(t, { email: 'beto@mail.com', device: DEVICE_B });
  const authB = bearer(b.tokens.accessToken);
  await putJson(
    t,
    '/v1/me/profile',
    profileBody({ city: 'Cali', primaryCurrency: 'COP', onboardingStep: 'ai_mode' }),
    authB,
  );
  await postJson(t, '/v1/me/onboarding/complete', { defaultAccountId: B_ACCOUNT }, authB);
  return { a: a.tokens.accessToken, b: b.tokens.accessToken, bId: b.me.id };
}

describe('FR-027: cada usuario solo ve y cambia sus propios datos', () => {
  it('GET /v1/me devuelve solo los datos de quien presenta el token', async () => {
    const { a, b, bId } = await twoUsers();
    const meA = await getMe(a);
    expect(meA.email).toBe('ana@mail.com');
    expect(meA.id).not.toBe(bId);
    expect(meA.defaultAccount).toBeNull();
    expect((await getMe(b)).email).toBe('beto@mail.com');
  });

  it('cambiar el perfil con el token de A no toca el perfil de B', async () => {
    const { a, b } = await twoUsers();
    const res = await putJson(
      t,
      '/v1/me/profile',
      profileBody({ city: 'Bogotá', primaryCurrency: 'USD', onboardingStep: 'currency' }),
      bearer(a),
    );
    expect(res.status).toBe(200);

    const meB = await getMe(b);
    expect(meB.profile.city).toBe('Cali');
    expect(meB.profile.primaryCurrency).toBe('COP');
  });

  it('A no puede quedarse con la cuenta de B usando su id al terminar el onboarding', async () => {
    const { a, b } = await twoUsers();
    await putJson(
      t,
      '/v1/me/profile',
      profileBody({ primaryCurrency: 'USD', onboardingStep: 'ai_mode' }),
      bearer(a),
    );
    const res = await postJson(
      t,
      '/v1/me/onboarding/complete',
      { defaultAccountId: B_ACCOUNT },
      bearer(a),
    );
    expect(res.status).toBe(400);
    expect((await jsonBody(res)).code).toBe('validation_error');

    expect((await getMe(a)).defaultAccount).toBeNull();
    const accountB = (await getMe(b)).defaultAccount;
    expect(accountB?.id).toBe(B_ACCOUNT);
    expect(accountB?.currency).toBe('COP');
  });

  it('borrar la cuenta de A no afecta a B', async () => {
    const { a, b } = await twoUsers();
    const res = await t.app.request('/v1/me', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', ...bearer(a) },
      body: JSON.stringify({ password: 'clave1234' }),
    });
    expect(res.status).toBe(204);

    const meB = await getMe(b);
    expect(meB.email).toBe('beto@mail.com');
    expect(meB.defaultAccount?.id).toBe(B_ACCOUNT);
  }, 30_000);
});
