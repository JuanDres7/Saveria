import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  bearer,
  deleteJson,
  onboardUser,
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

describe('FR-039: cuentas y movimientos de cada usuario', () => {
  const account = (overrides: Record<string, unknown> = {}) => ({
    name: 'Nequi',
    type: 'wallet',
    currency: 'COP',
    initialBalance: '0',
    isDefault: false,
    archivedAt: null,
    updatedAt: '2026-10-22T12:00:05.000Z',
    ...overrides,
  });
  const movement = (accountId: string, overrides: Record<string, unknown> = {}) => ({
    type: 'expense',
    accountId,
    amount: '18000',
    currency: 'COP',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
    categorySlug: 'dining',
    description: null,
    occurredOn: '2026-10-22',
    deletedAt: null,
    updatedAt: '2026-10-22T12:00:06.000Z',
    ...overrides,
  });

  /** A y B con el onboarding terminado; B además con un movimiento. */
  async function usersWithData() {
    const a = await onboardUser(t, { email: 'ana@mail.com' });
    const b = await onboardUser(t, { email: 'beto@mail.com' });
    const txB = crypto.randomUUID();
    await putJson(t, `/v1/transactions/${txB}`, movement(b.accountId), b.headers);
    return { a, b, txB };
  }

  it('A no puede crear ni editar la cuenta de B (404, sin revelar que existe)', async () => {
    const { a, b } = await usersWithData();
    const res = await putJson(
      t,
      `/v1/accounts/${b.accountId}`,
      account({ name: 'Mía' }),
      a.headers,
    );
    expect(res.status).toBe(404);
    // La cuenta de B sigue como estaba.
    const me = await jsonBody<MeJson>(await t.app.request('/v1/me', { headers: b.headers }));
    expect(me.defaultAccount?.id).toBe(b.accountId);
  });

  it('A no puede editar ni borrar el movimiento de B (404) y el movimiento no cambia', async () => {
    const { a, b, txB } = await usersWithData();
    const edit = await putJson(
      t,
      `/v1/transactions/${txB}`,
      movement(a.accountId, { amount: '1', updatedAt: '2026-10-22T12:00:09.000Z' }),
      a.headers,
    );
    expect(edit.status).toBe(404);
    const del = await deleteJson(
      t,
      `/v1/transactions/${txB}`,
      { updatedAt: '2026-10-22T12:00:09.000Z' },
      a.headers,
    );
    expect(del.status).toBe(404);

    // Para B sigue vivo y con su monto: su propio envío con una hora más nueva funciona.
    const again = await putJson(
      t,
      `/v1/transactions/${txB}`,
      movement(b.accountId, { updatedAt: '2026-10-22T12:00:07.000Z' }),
      b.headers,
    );
    expect(again.status).toBe(200);
    expect((await jsonBody<{ amount: string }>(again)).amount).toBe('18000');
  });

  it('A no puede usar una cuenta de B en un movimiento (400)', async () => {
    const { a, b } = await usersWithData();
    const res = await putJson(
      t,
      `/v1/transactions/${crypto.randomUUID()}`,
      movement(b.accountId),
      a.headers,
    );
    expect(res.status).toBe(400);
    expect((await jsonBody(res)).code).toBe('validation_error');
  });

  it('A no puede transferir hacia una cuenta de B (400)', async () => {
    const { a, b } = await usersWithData();
    const res = await putJson(
      t,
      `/v1/transactions/${crypto.randomUUID()}`,
      {
        ...movement(a.accountId),
        type: 'transfer',
        categorySlug: null,
        toAccountId: b.accountId,
        toAmount: '18000',
        toCurrency: 'COP',
      },
      a.headers,
    );
    expect(res.status).toBe(400);
  });
});
