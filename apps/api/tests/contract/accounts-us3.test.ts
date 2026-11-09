import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { bearer, onboardUser, putJson, registerUser } from '../support/auth-http';
import { expectMatchesContract } from '../support/contract';
import { jsonBody } from '../support/http';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;
let user: Awaited<ReturnType<typeof onboardUser>>;

beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(async () => {
  await t.reset();
  user = await onboardUser(t);
});
afterAll(() => t.close());

const PATH = '/v1/accounts/{id}';

const body = (overrides: Record<string, unknown> = {}) => ({
  name: 'Nequi',
  type: 'wallet',
  currency: 'COP',
  initialBalance: '80000',
  isDefault: false,
  archivedAt: null,
  updatedAt: '2026-10-22T12:00:05.000Z',
  ...overrides,
});

async function expectContract(res: Response, status: number) {
  expect(res.status).toBe(status);
  const json = await jsonBody<Record<string, unknown>>(res);
  expectMatchesContract('put', PATH, status, json);
  return json;
}

describe('contrato: PUT /v1/accounts/{id}', () => {
  it('200 con la cuenta guardada', async () => {
    const id = crypto.randomUUID();
    const res = await putJson(t, `/v1/accounts/${id}`, body(), user.headers);
    const json = await expectContract(res, 200);
    expect(json).toMatchObject({ id, name: 'Nequi', type: 'wallet', initialBalance: '80000' });
  });

  it('400 con un nombre ya usado por otra cuenta activa', async () => {
    const res = await putJson(
      t,
      `/v1/accounts/${crypto.randomUUID()}`,
      body({ name: 'efectivo' }),
      user.headers,
    );
    const json = await expectContract(res, 400);
    expect(json.code).toBe('validation_error');
  });

  it('401 sin token', async () => {
    const res = await putJson(t, `/v1/accounts/${crypto.randomUUID()}`, body(), {});
    await expectContract(res, 401);
  });

  it('404 con el id de una cuenta de otro usuario', async () => {
    const other = await onboardUser(t, { email: 'otro@mail.com' });
    const res = await putJson(t, `/v1/accounts/${user.accountId}`, body(), other.headers);
    await expectContract(res, 404);
  });

  it('409 con la versión del servidor si llega un cambio más viejo', async () => {
    const id = crypto.randomUUID();
    await putJson(t, `/v1/accounts/${id}`, body(), user.headers);
    const res = await putJson(
      t,
      `/v1/accounts/${id}`,
      body({ name: 'Vieja', updatedAt: '2026-10-22T12:00:01.000Z' }),
      user.headers,
    );
    const json = await expectContract(res, 409);
    expect(json.name).toBe('Nequi');
  });

  it('422 si el usuario no tiene moneda principal', async () => {
    const auth = await registerUser(t, { email: 'nuevo@mail.com' });
    const res = await putJson(
      t,
      `/v1/accounts/${crypto.randomUUID()}`,
      body(),
      bearer(auth.tokens.accessToken),
    );
    await expectContract(res, 422);
  });
});
