import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { bearer, postJson, profileBody, putJson, registerUser } from '../support/auth-http';
import { expectMatchesContract } from '../support/contract';
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

async function expectContract(res: Response, method: 'put' | 'post', path: string, status: number) {
  expect(res.status).toBe(status);
  const body = await jsonBody<Record<string, unknown>>(res);
  expectMatchesContract(method, path, status, body);
  return body;
}

describe('contrato: PUT /v1/me/profile', () => {
  it('200 con el perfil guardado', async () => {
    const res = await putJson(
      t,
      '/v1/me/profile',
      profileBody({ countryCode: 'CO' }),
      bearer(token),
    );
    const body = await expectContract(res, 'put', '/v1/me/profile', 200);
    expect(body.countryCode).toBe('CO');
  });

  it('400 con un dato fuera del catálogo', async () => {
    const res = await putJson(
      t,
      '/v1/me/profile',
      profileBody({ countryCode: 'XX' }),
      bearer(token),
    );
    const body = await expectContract(res, 'put', '/v1/me/profile', 400);
    expect(body.code).toBe('validation_error');
  });

  it('400 si falta un campo', async () => {
    const { aiMode: _omit, ...rest } = profileBody();
    const res = await putJson(t, '/v1/me/profile', rest, bearer(token));
    await expectContract(res, 'put', '/v1/me/profile', 400);
  });

  it('400 al pasar a done sin moneda principal', async () => {
    const res = await putJson(
      t,
      '/v1/me/profile',
      profileBody({ onboardingStep: 'done' }),
      bearer(token),
    );
    await expectContract(res, 'put', '/v1/me/profile', 400);
  });

  it('409 con la versión del servidor si el cambio es más viejo', async () => {
    const res = await putJson(
      t,
      '/v1/me/profile',
      profileBody({ aiName: 'Ana', updatedAt: '2020-01-01T00:00:00.000Z' }),
      bearer(token),
    );
    const body = await expectContract(res, 'put', '/v1/me/profile', 409);
    expect(body.aiName).toBeNull();
    expect(body.onboardingStep).toBe('ai_name');
  });

  it('401 sin token', async () => {
    const res = await putJson(t, '/v1/me/profile', profileBody(), {});
    await expectContract(res, 'put', '/v1/me/profile', 401);
  });
});

describe('contrato: POST /v1/me/onboarding/complete', () => {
  it('200 con Me y la cuenta por defecto', async () => {
    await putJson(
      t,
      '/v1/me/profile',
      profileBody({ primaryCurrency: 'COP', onboardingStep: 'ai_mode' }),
      bearer(token),
    );
    const res = await postJson(
      t,
      '/v1/me/onboarding/complete',
      { defaultAccountId: ACCOUNT_ID },
      bearer(token),
    );
    const body = await expectContract(res, 'post', '/v1/me/onboarding/complete', 200);
    expect((body.defaultAccount as { id: string }).id).toBe(ACCOUNT_ID);
  });

  it('422 primary_currency_required sin moneda principal', async () => {
    const res = await postJson(
      t,
      '/v1/me/onboarding/complete',
      { defaultAccountId: ACCOUNT_ID },
      bearer(token),
    );
    const body = await expectContract(res, 'post', '/v1/me/onboarding/complete', 422);
    expect(body.code).toBe('primary_currency_required');
  });

  it('400 validation_error si defaultAccountId no es un UUID', async () => {
    const res = await postJson(
      t,
      '/v1/me/onboarding/complete',
      { defaultAccountId: 'no-es-uuid' },
      bearer(token),
    );
    const body = await expectContract(res, 'post', '/v1/me/onboarding/complete', 400);
    expect(body.code).toBe('validation_error');
  });

  it('401 sin token', async () => {
    const res = await postJson(t, '/v1/me/onboarding/complete', { defaultAccountId: ACCOUNT_ID });
    await expectContract(res, 'post', '/v1/me/onboarding/complete', 401);
  });
});
