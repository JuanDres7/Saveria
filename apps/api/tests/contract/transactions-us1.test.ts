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

const PATH = '/v1/transactions/{id}';

const body = (overrides: Record<string, unknown> = {}) => ({
  type: 'expense',
  accountId: user.accountId,
  amount: '18000',
  currency: 'COP',
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
  categorySlug: 'dining',
  description: null,
  occurredOn: '2026-10-22',
  deletedAt: null,
  updatedAt: '2026-10-22T12:00:05.000Z',
  ...overrides,
});

async function expectContract(res: Response, status: number) {
  expect(res.status).toBe(status);
  const json = await jsonBody<Record<string, unknown>>(res);
  expectMatchesContract('put', PATH, status, json);
  return json;
}

describe('contrato: PUT /v1/transactions/{id}', () => {
  it('200 con el movimiento guardado', async () => {
    const id = crypto.randomUUID();
    const res = await putJson(t, `/v1/transactions/${id}`, body(), user.headers);
    const json = await expectContract(res, 200);
    expect(json).toMatchObject({ id, amount: '18000', type: 'expense' });
  });

  it('400 con un monto inválido', async () => {
    const res = await putJson(
      t,
      `/v1/transactions/${crypto.randomUUID()}`,
      body({ amount: '0' }),
      user.headers,
    );
    const json = await expectContract(res, 400);
    expect(json.code).toBe('validation_error');
  });

  it('400 si el id no es un UUID', async () => {
    const res = await putJson(t, '/v1/transactions/no-es-uuid', body(), user.headers);
    expect(res.status).toBe(400);
  });

  it('401 sin token', async () => {
    const res = await putJson(t, `/v1/transactions/${crypto.randomUUID()}`, body(), {});
    await expectContract(res, 401);
  });

  it('404 con el id de un movimiento de otro usuario', async () => {
    const id = crypto.randomUUID();
    await putJson(t, `/v1/transactions/${id}`, body(), user.headers);
    const other = await onboardUser(t, { email: 'otro@mail.com' });
    const res = await putJson(
      t,
      `/v1/transactions/${id}`,
      body({ accountId: other.accountId, updatedAt: '2026-10-22T12:00:09.000Z' }),
      other.headers,
    );
    await expectContract(res, 404);
  });

  it('409 con la versión del servidor si llega un cambio igual o más viejo', async () => {
    const id = crypto.randomUUID();
    await putJson(t, `/v1/transactions/${id}`, body(), user.headers);
    const res = await putJson(t, `/v1/transactions/${id}`, body({ amount: '1' }), user.headers);
    const json = await expectContract(res, 409);
    expect(json.amount).toBe('18000');
  });

  it('422 si el usuario no tiene moneda principal', async () => {
    const auth = await registerUser(t, { email: 'nuevo@mail.com' });
    const res = await putJson(
      t,
      `/v1/transactions/${crypto.randomUUID()}`,
      body(),
      bearer(auth.tokens.accessToken),
    );
    await expectContract(res, 422);
  });
});
