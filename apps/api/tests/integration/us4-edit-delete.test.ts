import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { createRepositories } from '../../src/infrastructure/db/repositories';
import { deleteJson, onboardUser, putJson } from '../support/auth-http';
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

let tick = 0;
/** Cada envío con una hora más nueva, como hace el teléfono. */
const nextTime = () =>
  new Date(Date.parse('2026-10-22T12:00:05.000Z') + ++tick * 1000).toISOString();

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
  updatedAt: nextTime(),
  ...overrides,
});

const put = (id: string, body: Record<string, unknown>) =>
  putJson(t, `/v1/transactions/${id}`, body, user.headers);

const accountBody = (overrides: Record<string, unknown> = {}) => ({
  name: 'Nequi',
  type: 'wallet',
  currency: 'COP',
  initialBalance: '0',
  isDefault: false,
  archivedAt: null,
  updatedAt: nextTime(),
  ...overrides,
});

describe('historia 4: editar y borrar un movimiento', () => {
  it('4.1 editar el monto de 18.000 a 20.000 baja el saldo 2.000 más', async () => {
    const id = crypto.randomUUID();
    await put(id, movement());
    expect(await repos.transactions.balanceOf(user.accountId)).toBe('-18000');
    const edit = await put(id, movement({ amount: '20000' }));
    expect(edit.status).toBe(200);
    expect(await repos.transactions.balanceOf(user.accountId)).toBe('-20000');
  });

  it('4.2 mover a otra cuenta de la misma moneda mueve el saldo', async () => {
    const nequi = crypto.randomUUID();
    await putJson(t, `/v1/accounts/${nequi}`, accountBody(), user.headers);
    const id = crypto.randomUUID();
    await put(id, movement());
    await put(id, movement({ accountId: nequi }));
    expect(await repos.transactions.balanceOf(user.accountId)).toBe('0');
    expect(await repos.transactions.balanceOf(nequi)).toBe('-18000');
  });

  it('4.4 borrar devuelve el saldo', async () => {
    const id = crypto.randomUUID();
    await put(id, movement());
    const del = await deleteJson(
      t,
      `/v1/transactions/${id}`,
      { updatedAt: nextTime() },
      user.headers,
    );
    expect(del.status).toBe(204);
    expect(await repos.transactions.balanceOf(user.accountId)).toBe('0');
    // Borrado lógico: la fila sigue, con deleted_at.
    const rows = await client`select deleted_at from transactions where id = ${id}`;
    expect(rows[0]?.deleted_at).not.toBeNull();
  });

  it('4.5 restaurar ("Deshacer") lo vuelve a contar', async () => {
    const id = crypto.randomUUID();
    await put(id, movement());
    await deleteJson(t, `/v1/transactions/${id}`, { updatedAt: nextTime() }, user.headers);
    const restore = await put(id, movement());
    expect(restore.status).toBe(200);
    expect(await repos.transactions.balanceOf(user.accountId)).toBe('-18000');
  });

  it('cambiar la moneda de una cuenta con movimientos vivos no se permite, y sí con todos borrados', async () => {
    const nequi = crypto.randomUUID();
    await putJson(t, `/v1/accounts/${nequi}`, accountBody(), user.headers);
    const id = crypto.randomUUID();
    await put(id, movement({ accountId: nequi }));
    const blocked = await putJson(
      t,
      `/v1/accounts/${nequi}`,
      accountBody({ currency: 'USD' }),
      user.headers,
    );
    expect(blocked.status).toBe(400);
    await deleteJson(t, `/v1/transactions/${id}`, { updatedAt: nextTime() }, user.headers);
    const allowed = await putJson(
      t,
      `/v1/accounts/${nequi}`,
      accountBody({ currency: 'USD' }),
      user.headers,
    );
    expect(allowed.status).toBe(200);
  });
});
