import { describe, expect, it } from 'bun:test';
import { type LocalAccountRecord, LocalAccounts } from '../src/features/accounts/local-accounts';
import {
  type LocalTransactionRecord,
  LocalTransactions,
} from '../src/features/transactions/local-transactions';
import { createLocalDb } from './support';

const T = '2026-10-28T12:00:00.000Z';

const account = (over: Partial<LocalAccountRecord>): LocalAccountRecord => ({
  id: crypto.randomUUID(),
  name: 'Cuenta',
  type: 'cash',
  currency: 'COP',
  initialBalance: '0',
  isDefault: false,
  archivedAt: null,
  createdAt: T,
  updatedAt: T,
  deletedAt: null,
  syncState: 'synced',
  syncError: null,
  ...over,
});

let seq = 0;
const movement = (
  accountId: string,
  over: Partial<LocalTransactionRecord> = {},
): LocalTransactionRecord => {
  seq += 1;
  return {
    id: crypto.randomUUID(),
    type: 'expense',
    accountId,
    amount: '18000',
    currency: 'COP',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
    categorySlug: 'dining',
    description: null,
    occurredOn: '2026-10-28',
    createdAt: `2026-10-28T12:00:${String(seq % 60).padStart(2, '0')}.000Z`,
    updatedAt: T,
    deletedAt: null,
    syncState: 'pending',
    syncError: null,
    ...over,
  };
};

function setup() {
  const { db } = createLocalDb();
  const accounts = new LocalAccounts(db);
  const ledger = new LocalTransactions(db);
  const efectivo = account({ name: 'Efectivo', isDefault: true, initialBalance: '100000' });
  const nequi = account({ name: 'Nequi', type: 'wallet' });
  const usd = account({ name: 'Ahorros USD', currency: 'USD', initialBalance: '50.25' });
  for (const a of [efectivo, nequi, usd]) accounts.save(a);
  return { accounts, ledger, efectivo, nequi, usd };
}

describe('saldos locales (SC-003)', () => {
  it('2.1 saldo inicial + ingresos − gastos', () => {
    const { ledger, efectivo } = setup();
    ledger.save(movement(efectivo.id, { type: 'income', categorySlug: 'salary', amount: '50000' }));
    ledger.save(movement(efectivo.id, { amount: '30000' }));
    expect(ledger.balances().get(efectivo.id)).toBe('120000');
  });

  it('coincide al centavo con transferencias en dos monedas y ajustes, sin los borrados', () => {
    const { ledger, efectivo, nequi, usd } = setup();
    ledger.save(movement(efectivo.id, { type: 'adjustment', categorySlug: null, amount: '-5000' }));
    ledger.save(
      movement(efectivo.id, {
        type: 'transfer',
        categorySlug: null,
        amount: '20000',
        toAccountId: nequi.id,
        toAmount: '20000',
        toCurrency: 'COP',
      }),
    );
    ledger.save(
      movement(usd.id, {
        type: 'transfer',
        categorySlug: null,
        amount: '10.25',
        currency: 'USD',
        toAccountId: nequi.id,
        toAmount: '40000',
        toCurrency: 'COP',
      }),
    );
    const deleted = movement(efectivo.id, { amount: '99999' });
    ledger.save(deleted);
    ledger.softDelete(deleted.id, T);

    const balances = ledger.balances();
    expect(balances.get(efectivo.id)).toBe('75000');
    expect(balances.get(nequi.id)).toBe('60000');
    expect(balances.get(usd.id)).toBe('40');
  });

  it('suma exacta con decimales que el punto flotante redondea mal', () => {
    const { ledger, usd } = setup();
    for (let i = 0; i < 10; i++) {
      ledger.save(
        movement(usd.id, {
          currency: 'USD',
          amount: '0.10',
          type: 'income',
          categorySlug: 'refunds',
        }),
      );
    }
    expect(ledger.balances().get(usd.id)).toBe('51.25');
  });

  it('suma exacta con montos de 12 dígitos (más allá de lo que un number guarda exacto)', () => {
    const { ledger, nequi } = setup();
    ledger.save(
      movement(nequi.id, { type: 'income', categorySlug: 'business', amount: '999999999999' }),
    );
    ledger.save(
      movement(nequi.id, { type: 'income', categorySlug: 'business', amount: '999999999999' }),
    );
    expect(ledger.balances().get(nequi.id)).toBe('1999999999998');
  });

  it('restaurar un borrado lo vuelve a contar', () => {
    const { ledger, efectivo } = setup();
    const gasto = movement(efectivo.id);
    ledger.save(gasto);
    ledger.softDelete(gasto.id, T);
    expect(ledger.balances().get(efectivo.id)).toBe('100000');
    ledger.restore(gasto.id, T);
    expect(ledger.balances().get(efectivo.id)).toBe('82000');
  });

  it('cambiar el saldo inicial de una cuenta cambia su saldo', () => {
    const { accounts, ledger, nequi } = setup();
    accounts.save({ ...nequi, initialBalance: '80000' });
    expect(ledger.balances().get(nequi.id)).toBe('80000');
  });
});

describe('historial local', () => {
  it('2.2 del más reciente al más antiguo: por día y, dentro del día, por hora de registro', () => {
    const { ledger, efectivo } = setup();
    const ayer = movement(efectivo.id, { occurredOn: '2026-10-27', description: 'ayer' });
    const hoy1 = movement(efectivo.id, { description: 'hoy 1' });
    const hoy2 = movement(efectivo.id, { description: 'hoy 2' });
    for (const m of [hoy1, ayer, hoy2]) ledger.save(m);
    expect(ledger.history().map((m) => m.description)).toEqual(['hoy 2', 'hoy 1', 'ayer']);
  });

  it('2.3 el filtro por cuenta incluye las transferencias que entran', () => {
    const { ledger, efectivo, nequi } = setup();
    ledger.save(movement(efectivo.id, { description: 'gasto efectivo' }));
    ledger.save(movement(nequi.id, { description: 'gasto nequi' }));
    ledger.save(
      movement(efectivo.id, {
        type: 'transfer',
        categorySlug: null,
        amount: '1000',
        toAccountId: nequi.id,
        toAmount: '1000',
        toCurrency: 'COP',
        description: 'a nequi',
      }),
    );
    expect(
      ledger
        .history({ accountId: nequi.id })
        .map((m) => m.description)
        .sort(),
    ).toEqual(['a nequi', 'gasto nequi']);
  });

  it('pagina de 50 en 50 y no muestra los borrados', () => {
    const { ledger, efectivo } = setup();
    for (let i = 0; i < 60; i++) ledger.save(movement(efectivo.id));
    const borrado = movement(efectivo.id);
    ledger.save(borrado);
    ledger.softDelete(borrado.id, T);
    expect(ledger.history()).toHaveLength(50);
    expect(ledger.history({ offset: 50 })).toHaveLength(10);
  });

  it('existsForAccount ve los movimientos como origen y como destino', () => {
    const { ledger, efectivo, nequi } = setup();
    expect(ledger.existsForAccount(nequi.id)).toBe(false);
    ledger.save(
      movement(efectivo.id, {
        type: 'transfer',
        categorySlug: null,
        toAccountId: nequi.id,
        toAmount: '18000',
        toCurrency: 'COP',
      }),
    );
    expect(ledger.existsForAccount(nequi.id)).toBe(true);
  });

  it('markSync guarda el estado de envío y el motivo del rechazo', () => {
    const { ledger, efectivo } = setup();
    const gasto = movement(efectivo.id);
    ledger.save(gasto);
    ledger.markSync(gasto.id, 'rejected', 'La cuenta no existe');
    expect(ledger.findById(gasto.id)).toMatchObject({
      syncState: 'rejected',
      syncError: 'La cuenta no existe',
    });
  });
});
