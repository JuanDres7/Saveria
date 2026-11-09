import { describe, expect, it } from 'bun:test';
import { type LocalAccountRecord, LocalAccounts } from '../src/features/accounts/local-accounts';
import {
  type LocalTransactionRecord,
  LocalTransactions,
} from '../src/features/transactions/local-transactions';
import { createLocalDb } from './support';

/**
 * SC-004: con 5.000 movimientos el historial y los saldos aparecen en menos de 1 segundo. Aquí se
 * mide la parte de base de datos con un SQLite real (en el PC); el paso 15 del quickstart lo mide
 * en el emulador con la base cifrada.
 */
const COUNT = 5000;
const LIMIT_MS = 1000;

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

function seed() {
  const { sqlite, db } = createLocalDb();
  const accounts = new LocalAccounts(db);
  const ledger = new LocalTransactions(db);
  const efectivo = account({ name: 'Efectivo', isDefault: true, initialBalance: '1000000' });
  const nequi = account({ name: 'Nequi', type: 'wallet' });
  accounts.save(efectivo);
  accounts.save(nequi);

  const base = Date.parse('2026-01-01T00:00:00.000Z');
  sqlite.run('BEGIN');
  for (let i = 0; i < COUNT; i++) {
    const day = new Date(base + Math.floor(i / 14) * 86_400_000).toISOString().slice(0, 10);
    const tx: LocalTransactionRecord = {
      id: crypto.randomUUID(),
      type: i % 10 === 0 ? 'income' : 'expense',
      accountId: i % 3 === 0 ? nequi.id : efectivo.id,
      amount: String(1000 + (i % 97)),
      currency: 'COP',
      toAccountId: null,
      toAmount: null,
      toCurrency: null,
      categorySlug: i % 10 === 0 ? 'salary' : 'dining',
      description: null,
      occurredOn: day,
      createdAt: new Date(base + i * 1000).toISOString(),
      updatedAt: T,
      deletedAt: null,
      syncState: 'synced',
      syncError: null,
    };
    ledger.save(tx);
  }
  sqlite.run('COMMIT');
  return { ledger, efectivo, nequi };
}

function elapsed(work: () => void, label = ''): number {
  const start = performance.now();
  work();
  const ms = performance.now() - start;
  if (label) console.log(`  [rendimiento] ${label}: ${ms.toFixed(1)} ms`);
  return ms;
}

describe('SC-004: 5.000 movimientos', () => {
  const { ledger, efectivo } = seed();

  it(`los saldos de todas las cuentas se calculan en menos de ${LIMIT_MS} ms`, () => {
    let balances = new Map<string, string>();
    const ms = elapsed(() => {
      balances = ledger.balances();
    }, 'saldos de 2 cuentas');
    expect(balances.size).toBe(2);
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  it(`la primera página del historial carga en menos de ${LIMIT_MS} ms`, () => {
    let page: LocalTransactionRecord[] = [];
    const ms = elapsed(() => {
      page = ledger.history();
    }, 'primera página del historial');
    expect(page).toHaveLength(50);
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  it(`una página lejana y el filtro por cuenta también bajan de ${LIMIT_MS} ms`, () => {
    let far: LocalTransactionRecord[] = [];
    let filtered: LocalTransactionRecord[] = [];
    const farMs = elapsed(() => {
      far = ledger.history({ offset: 4900 });
    }, 'página lejana (offset 4900)');
    const filterMs = elapsed(() => {
      filtered = ledger.history({ accountId: efectivo.id });
    }, 'filtro por cuenta');
    expect(far).toHaveLength(50);
    expect(filtered).toHaveLength(50);
    expect(farMs).toBeLessThan(LIMIT_MS);
    expect(filterMs).toBeLessThan(LIMIT_MS);
  });

  it('el saldo sigue siendo exacto con 5.000 movimientos', () => {
    // Se recalcula a mano con enteros, sin punto flotante.
    let expected = 1_000_000n;
    for (let i = 0; i < COUNT; i++) {
      if (i % 3 === 0) continue; // son de Nequi
      const amount = BigInt(1000 + (i % 97));
      expected += i % 10 === 0 ? amount : -amount;
    }
    expect(ledger.balances().get(efectivo.id)).toBe(String(expected));
  });
});
