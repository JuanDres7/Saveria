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

const ARCHIVED = '2026-10-21T00:00:00.000Z';
let tick = 0;
/** Cada envío con una hora más nueva, como hace el teléfono. */
const nextTime = () =>
  new Date(Date.parse('2026-10-22T12:00:05.000Z') + ++tick * 1000).toISOString();

const account = (overrides: Record<string, unknown> = {}) => ({
  name: 'Nequi',
  type: 'wallet',
  currency: 'COP',
  initialBalance: '80000',
  isDefault: false,
  archivedAt: null,
  updatedAt: nextTime(),
  ...overrides,
});

const efectivo = (overrides: Record<string, unknown> = {}) =>
  account({ name: 'Efectivo', type: 'cash', initialBalance: '0', isDefault: true, ...overrides });

describe('historia 3: gestionar cuentas', () => {
  it('3.1 y 3.3 crear "Nequi" con 80.000 y marcarla por defecto deja "Efectivo" sin marca', async () => {
    const id = crypto.randomUUID();
    const res = await putJson(t, `/v1/accounts/${id}`, account({ isDefault: true }), user.headers);
    expect(res.status).toBe(200);
    expect(await repos.transactions.balanceOf(id)).toBe('80000');
    expect((await repos.accounts.findDefaultByUser(user.userId))?.id).toBe(id);
    expect((await repos.accounts.findById(user.accountId))?.isDefault).toBe(false);
  });

  it('3.4 renombrar', async () => {
    const id = crypto.randomUUID();
    await putJson(t, `/v1/accounts/${id}`, account(), user.headers);
    await putJson(t, `/v1/accounts/${id}`, account({ name: 'Nequi personal' }), user.headers);
    expect((await repos.accounts.findById(id))?.name).toBe('Nequi personal');
  });

  it('3.6 y FR-021 archivar con saldo y reactivar', async () => {
    const id = crypto.randomUUID();
    await putJson(t, `/v1/accounts/${id}`, account(), user.headers);
    const archived = await putJson(
      t,
      `/v1/accounts/${id}`,
      account({ archivedAt: ARCHIVED }),
      user.headers,
    );
    expect(archived.status).toBe(200);
    expect((await repos.accounts.findById(id))?.archivedAt?.toISOString()).toBe(ARCHIVED);
    const back = await putJson(t, `/v1/accounts/${id}`, account(), user.headers);
    expect(back.status).toBe(200);
    expect((await repos.accounts.findById(id))?.archivedAt).toBeNull();
  });

  it('el índice de cuenta por defecto no falla si después llega el PUT de la anterior sin la marca', async () => {
    const id = crypto.randomUUID();
    const nueva = await putJson(
      t,
      `/v1/accounts/${id}`,
      account({ isDefault: true }),
      user.headers,
    );
    expect(nueva.status).toBe(200);
    const anterior = await putJson(
      t,
      `/v1/accounts/${user.accountId}`,
      efectivo({ isDefault: false }),
      user.headers,
    );
    expect(anterior.status).toBe(200);
    expect((await repos.accounts.findDefaultByUser(user.userId))?.id).toBe(id);
  });
});
