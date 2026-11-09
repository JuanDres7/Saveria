/**
 * Siembra movimientos SOLO para desarrollo: sirve para medir en el emulador que el historial y los
 * saldos responden rápido con muchos movimientos (SC-004, paso 15 del quickstart). Se activa
 * arrancando Metro con `EXPO_PUBLIC_SEED_TRANSACTIONS=5000`; espera a que haya una sesión con la
 * base abierta y escribe líneas [SEED] en el log. No forma parte del flujo normal de la app.
 *
 * Los movimientos se guardan como ya enviados (`synced`) y sin encolar nada, para no inundar el
 * outbox ni el servidor.
 */
import { currencyDecimals } from '@saveria/shared';
import * as Crypto from 'expo-crypto';
import { getOpenUserDb } from '../db/open-user-db';
import { LocalAccounts } from '../features/accounts/local-accounts';
import { refreshLedger } from '../features/transactions/ledger';
import { LocalTransactions } from '../features/transactions/local-transactions';

const WAIT_MS = 1000;
const MAX_WAIT_MS = 5 * 60 * 1000;

/** Un monto válido para la moneda de la cuenta: entero si no tiene decimales, con ".50" si no. */
function seedAmount(i: number, currency: string): string {
  const value = 1000 + (i % 97);
  return currencyDecimals(currency) === 0 ? String(value) : `${value}.50`;
}

export async function runSeed(count: number): Promise<void> {
  const started = Date.now();
  let open = getOpenUserDb();
  while (!open && Date.now() - started < MAX_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
    open = getOpenUserDb();
  }
  if (!open) {
    console.log('[SEED] no hubo sesión con la base abierta: no se sembró nada');
    return;
  }

  const accounts = new LocalAccounts(open.db).list().filter((a) => a.archivedAt === null);
  if (accounts.length === 0) {
    console.log('[SEED] el usuario no tiene cuentas activas: no se sembró nada');
    return;
  }
  const ledger = new LocalTransactions(open.db);

  const t0 = Date.now();
  const base = Date.now() - count * 3_600_000;
  for (let i = 0; i < count; i++) {
    const account = accounts[i % accounts.length];
    if (!account) continue;
    const at = new Date(base + i * 3_600_000);
    const income = i % 10 === 0;
    ledger.save({
      id: Crypto.randomUUID(),
      type: income ? 'income' : 'expense',
      accountId: account.id,
      amount: seedAmount(i, account.currency),
      currency: account.currency,
      toAccountId: null,
      toAmount: null,
      toCurrency: null,
      categorySlug: income ? 'salary' : 'dining',
      description: 'sembrado',
      occurredOn: at.toISOString().slice(0, 10),
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      deletedAt: null,
      syncState: 'synced',
      syncError: null,
    });
  }
  console.log(`[SEED] ${count} movimientos sembrados en ${Date.now() - t0} ms`);

  const t1 = Date.now();
  const balances = ledger.balances();
  console.log(`[SEED] saldos de ${balances.size} cuentas en ${Date.now() - t1} ms`);
  const t2 = Date.now();
  const page = ledger.history();
  console.log(`[SEED] primera página (${page.length}) en ${Date.now() - t2} ms`);

  refreshLedger();
}
