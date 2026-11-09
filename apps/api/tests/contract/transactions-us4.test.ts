import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { deleteJson, onboardUser, putJson } from '../support/auth-http';
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

const movement = (overrides: Record<string, unknown> = {}) => ({
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

const created = async () => {
  const id = crypto.randomUUID();
  await putJson(t, `/v1/transactions/${id}`, movement(), user.headers);
  return id;
};

describe('contrato: DELETE /v1/transactions/{id}', () => {
  it('204 al borrar', async () => {
    const id = await created();
    const res = await deleteJson(
      t,
      `/v1/transactions/${id}`,
      { updatedAt: '2026-10-22T12:00:09.000Z' },
      user.headers,
    );
    expect(res.status).toBe(204);
  });

  it('204 también para un id que el servidor no conoce', async () => {
    const res = await deleteJson(
      t,
      `/v1/transactions/${crypto.randomUUID()}`,
      { updatedAt: '2026-10-22T12:00:09.000Z' },
      user.headers,
    );
    expect(res.status).toBe(204);
  });

  it('400 sin updatedAt', async () => {
    const id = await created();
    const res = await deleteJson(t, `/v1/transactions/${id}`, {}, user.headers);
    expect(res.status).toBe(400);
    expectMatchesContract('delete', PATH, 400, await jsonBody(res));
  });

  it('401 sin token', async () => {
    const id = await created();
    const res = await deleteJson(
      t,
      `/v1/transactions/${id}`,
      { updatedAt: '2026-10-22T12:00:09.000Z' },
      {},
    );
    expect(res.status).toBe(401);
    expectMatchesContract('delete', PATH, 401, await jsonBody(res));
  });

  it('404 con el id de un movimiento de otro usuario', async () => {
    const id = await created();
    const other = await onboardUser(t, { email: 'otro@mail.com' });
    const res = await deleteJson(
      t,
      `/v1/transactions/${id}`,
      { updatedAt: '2026-10-22T12:00:09.000Z' },
      other.headers,
    );
    expect(res.status).toBe(404);
    expectMatchesContract('delete', PATH, 404, await jsonBody(res));
  });

  it('409 con la versión del servidor si el borrado es más viejo', async () => {
    const id = await created();
    const res = await deleteJson(
      t,
      `/v1/transactions/${id}`,
      { updatedAt: '2026-10-22T12:00:01.000Z' },
      user.headers,
    );
    expect(res.status).toBe(409);
    const json = await jsonBody<Record<string, unknown>>(res);
    expectMatchesContract('delete', PATH, 409, json);
    expect(json.deletedAt).toBeNull();
  });
});
