import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { createRepositories } from '../../src/infrastructure/db/repositories';
import { onboardUser, putJson } from '../support/auth-http';
import { createTestDb } from '../support/db';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;
let user: Awaited<ReturnType<typeof onboardUser>>;
const { db, client } = createTestDb();
const repos = createRepositories(db);

beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(async () => {
  await t.reset();
  user = await onboardUser(t);
});
afterAll(async () => {
  await client.end();
  await t.close();
});

const movement = (overrides: Record<string, unknown> = {}) => ({
  type: 'expense',
  accountId: user.accountId,
  amount: '18000',
  currency: 'COP',
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
  categorySlug: 'dining',
  description: 'Almuerzo',
  occurredOn: '2026-10-22',
  deletedAt: null,
  updatedAt: '2026-10-22T12:00:05.000Z',
  ...overrides,
});

describe('historia 1: registrar un gasto o un ingreso', () => {
  it('1.2 y 1.4 un gasto y un ingreso enviados por el teléfono cambian el saldo de "Efectivo"', async () => {
    const gasto = await putJson(
      t,
      `/v1/transactions/${crypto.randomUUID()}`,
      movement(),
      user.headers,
    );
    const ingreso = await putJson(
      t,
      `/v1/transactions/${crypto.randomUUID()}`,
      movement({ type: 'income', categorySlug: 'salary', amount: '50000', description: null }),
      user.headers,
    );
    expect(gasto.status).toBe(200);
    expect(ingreso.status).toBe(200);
    // 0 − 18.000 + 50.000
    expect(await repos.transactions.balanceOf(user.accountId)).toBe('32000');
  });

  it('1.7 y FR-036 el mismo PUT dos veces deja una sola fila', async () => {
    const id = crypto.randomUUID();
    await putJson(t, `/v1/transactions/${id}`, movement(), user.headers);
    const retry = await putJson(t, `/v1/transactions/${id}`, movement(), user.headers);
    expect(retry.status).toBe(200);
    const rows = await client`select count(*)::int as n from transactions where id = ${id}`;
    expect(rows[0]?.n).toBe(1);
    expect(await repos.transactions.balanceOf(user.accountId)).toBe('-18000');
  });
});
