import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { bearer, postJson, profileBody, putJson, registerUser } from '../support/auth-http';
import { jsonBody } from '../support/http';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;
let token: string;

beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(async () => {
  await t.reset();
  token = (await registerUser(t)).tokens.accessToken;
});
afterAll(() => t.close());

const ACCOUNT_ID = '0199a1b2-0000-7000-8000-00000000a001';

interface MeJson {
  profile: Record<string, unknown> & { onboardingStep: string };
  defaultAccount: {
    id: string;
    name: string;
    currency: string;
    initialBalance: string;
    isDefault: boolean;
  } | null;
}

const getMe = async () =>
  jsonBody<MeJson>(await t.app.request('/v1/me', { headers: bearer(token) }));

let second = 0;
/** Cada paso con un `updatedAt` un segundo más nuevo, como haría el teléfono. */
async function saveStep(fields: Record<string, unknown>) {
  second += 1;
  const updatedAt = new Date(Date.UTC(2026, 9, 22, 12, 0, second)).toISOString();
  const res = await putJson(
    t,
    '/v1/me/profile',
    profileBody({ ...fields, updatedAt }),
    bearer(token),
  );
  expect(res.status).toBe(200);
}

describe('historia 2: onboarding', () => {
  beforeEach(() => {
    second = 0;
  });

  it('recorrido completo: 2.1 a 2.4, con "Efectivo" en COP y saldo 0 en GET /v1/me', async () => {
    expect((await getMe()).profile.onboardingStep).toBe('ai_name');

    const answers = { aiName: 'Ana' };
    await saveStep({ ...answers, onboardingStep: 'country' });
    Object.assign(answers, { countryCode: 'CO' });
    await saveStep({ ...answers, onboardingStep: 'city' });
    Object.assign(answers, { city: 'Medellín' });
    await saveStep({ ...answers, onboardingStep: 'currency' });
    Object.assign(answers, { primaryCurrency: 'COP' });
    await saveStep({ ...answers, onboardingStep: 'ai_mode' });

    const res = await postJson(
      t,
      '/v1/me/onboarding/complete',
      { defaultAccountId: ACCOUNT_ID },
      bearer(token),
    );
    expect(res.status).toBe(200);

    const me = await getMe();
    expect(me.profile).toMatchObject({
      aiName: 'Ana',
      countryCode: 'CO',
      city: 'Medellín',
      primaryCurrency: 'COP',
      aiMode: 'manual',
      onboardingStep: 'done',
    });
    expect(me.defaultAccount).toEqual({
      id: ACCOUNT_ID,
      name: 'Efectivo',
      currency: 'COP',
      initialBalance: '0',
      isDefault: true,
    });
  });

  it('2.5 retomar: GET /v1/me devuelve el paso pendiente y lo ya respondido', async () => {
    await saveStep({ aiName: 'Ana', onboardingStep: 'country' });
    await saveStep({ aiName: 'Ana', countryCode: 'CO', onboardingStep: 'city' });
    const me = await getMe();
    expect(me.profile.onboardingStep).toBe('city');
    expect(me.profile.countryCode).toBe('CO');
    expect(me.defaultAccount).toBeNull();
  });

  it('completar dos veces (reintento del outbox) deja una sola cuenta', async () => {
    await saveStep({ primaryCurrency: 'COP', onboardingStep: 'ai_mode' });
    for (let i = 0; i < 2; i += 1) {
      const res = await postJson(
        t,
        '/v1/me/onboarding/complete',
        { defaultAccountId: ACCOUNT_ID },
        bearer(token),
      );
      expect(res.status).toBe(200);
    }
    expect((await getMe()).defaultAccount?.id).toBe(ACCOUNT_ID);
    expect(await t.container.repositories.accounts.findById(ACCOUNT_ID)).not.toBeNull();
  });

  it('cambiar la moneda principal después no cambia la moneda de "Efectivo" (FR-021)', async () => {
    await saveStep({ primaryCurrency: 'COP', onboardingStep: 'ai_mode' });
    await postJson(
      t,
      '/v1/me/onboarding/complete',
      { defaultAccountId: ACCOUNT_ID },
      bearer(token),
    );
    await saveStep({ primaryCurrency: 'USD', onboardingStep: 'done' });
    const me = await getMe();
    expect(me.profile.primaryCurrency).toBe('USD');
    expect(me.defaultAccount?.currency).toBe('COP');
  });
});
