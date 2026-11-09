import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { createRepositories } from '../../src/infrastructure/db/repositories';
import { deleteJson, onboardUser, putJson } from '../support/auth-http';
import { createTestDb } from '../support/db';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;
let user: Awaited<ReturnType<typeof onboardUser>>;
let nequi: string;
let usd: string;
const { db, client } = createTestDb();
const repos = createRepositories(db);

let tick = 0;
/** Cada envío con una hora más nueva, como hace el teléfono. */
const nextTime = () =>
  new Date(Date.parse('2026-10-22T12:00:05.000Z') + ++tick * 1000).toISOString();

const account = (overrides: Record<string, unknown>) => ({
  name: 'Cuenta',
  type: 'wallet',
  currency: 'COP',
  initialBalance: '0',
  isDefault: false,
  archivedAt: null,
  updatedAt: nextTime(),
  ...overrides,
});

beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(async () => {
  await t.reset();
  user = await onboardUser(t);
  nequi = crypto.randomUUID();
  usd = crypto.randomUUID();
  await putJson(
    t,
    `/v1/accounts/${user.accountId}`,
    account({ name: 'Efectivo', type: 'cash', initialBalance: '300000', isDefault: true }),
    user.headers,
  );
  await putJson(t, `/v1/accounts/${nequi}`, account({ name: 'Nequi' }), user.headers);
  await putJson(
    t,
    `/v1/accounts/${usd}`,
    account({ name: 'Ahorros USD', currency: 'USD', initialBalance: '50' }),
    user.headers,
  );
});
afterAll(async () => {
  await client.end();
  await t.close();
});

const transfer = (overrides: Record<string, unknown> = {}) => ({
  type: 'transfer',
  accountId: user.accountId,
  amount: '100000',
  currency: 'COP',
  toAccountId: nequi,
  toAmount: '100000',
  toCurrency: 'COP',
  categorySlug: null,
  description: null,
  occurredOn: '2026-10-22',
  deletedAt: null,
  updatedAt: nextTime(),
  ...overrides,
});

const balances = async () => ({
  efectivo: await repos.transactions.balanceOf(user.accountId),
  nequi: await repos.transactions.balanceOf(nequi),
  usd: await repos.transactions.balanceOf(usd),
});

describe('historia 5: transferir entre cuentas', () => {
  it('5.1 100.000 COP de una cuenta a otra mueven ambos saldos en una sola fila', async () => {
    const id = crypto.randomUUID();
    const res = await putJson(t, `/v1/transactions/${id}`, transfer(), user.headers);
    expect(res.status).toBe(200);
    expect(await balances()).toEqual({ efectivo: '200000', nequi: '100000', usd: '50' });
    const rows =
      await client`select count(*)::int as n from transactions where user_id = ${user.userId}`;
    expect(rows[0]?.n).toBe(1);
  });

  it('5.2 no cuenta como gasto ni como ingreso', async () => {
    await putJson(t, `/v1/transactions/${crypto.randomUUID()}`, transfer(), user.headers);
    const rows = await client`
      select count(*)::int as n from transactions
      where user_id = ${user.userId} and type in ('expense', 'income')`;
    expect(rows[0]?.n).toBe(0);
  });

  it('5.3 10 USD → 40.000 COP: cada cuenta cambia en su moneda, sin tasa', async () => {
    const res = await putJson(
      t,
      `/v1/transactions/${crypto.randomUUID()}`,
      transfer({
        accountId: usd,
        currency: 'USD',
        amount: '10',
        toAmount: '40000',
        toCurrency: 'COP',
      }),
      user.headers,
    );
    expect(res.status).toBe(200);
    expect(await balances()).toEqual({ efectivo: '300000', nequi: '40000', usd: '40' });
  });

  it('5.4 la misma cuenta de origen y destino se rechaza', async () => {
    const res = await putJson(
      t,
      `/v1/transactions/${crypto.randomUUID()}`,
      transfer({ toAccountId: user.accountId }),
      user.headers,
    );
    expect(res.status).toBe(400);
  });

  it('5.5 editar el monto cambia los dos saldos juntos', async () => {
    const id = crypto.randomUUID();
    await putJson(t, `/v1/transactions/${id}`, transfer(), user.headers);
    await putJson(
      t,
      `/v1/transactions/${id}`,
      transfer({ amount: '150000', toAmount: '150000' }),
      user.headers,
    );
    expect(await balances()).toEqual({ efectivo: '150000', nequi: '150000', usd: '50' });
  });

  it('5.5 borrarla devuelve los dos saldos a la vez', async () => {
    const id = crypto.randomUUID();
    await putJson(t, `/v1/transactions/${id}`, transfer(), user.headers);
    const del = await deleteJson(
      t,
      `/v1/transactions/${id}`,
      { updatedAt: nextTime() },
      user.headers,
    );
    expect(del.status).toBe(204);
    expect(await balances()).toEqual({ efectivo: '300000', nequi: '0', usd: '50' });
  });

  it('la moneda de una cuenta que es destino de una transferencia viva no cambia', async () => {
    await putJson(t, `/v1/transactions/${crypto.randomUUID()}`, transfer(), user.headers);
    const res = await putJson(
      t,
      `/v1/accounts/${nequi}`,
      account({ name: 'Nequi', currency: 'USD' }),
      user.headers,
    );
    expect(res.status).toBe(400);
  });
});
