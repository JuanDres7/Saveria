import type { LocalAccountRecord } from '../../src/features/accounts/local-accounts';
import {
  type LedgerContext,
  refreshLedger,
  setLedgerContextForTests,
  useLedger,
} from '../../src/features/transactions/ledger';
import type { LocalTransactionRecord } from '../../src/features/transactions/local-transactions';
import { transactionOutboxHandlers } from '../../src/features/transactions/transaction-service';
import { createHttpSender } from '../../src/outbox/http-sender';
import { createOutbox } from '../../src/outbox/outbox';
import { type Me, useSession } from '../../src/session/session-store';
import { makeMe } from './fixtures';
import { MemoryAccounts, MemoryLedger, MemoryOutboxStore } from './memory';

const T = '2026-10-28T12:00:00.000Z';

export function makeAccountRecord(over: Partial<LocalAccountRecord> = {}): LocalAccountRecord {
  return {
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
  };
}

let seq = 0;
export function makeTxRecord(
  accountId: string,
  over: Partial<LocalTransactionRecord> = {},
): LocalTransactionRecord {
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
    createdAt: `2026-10-28T12:${String(Math.floor(seq / 60) % 60).padStart(2, '0')}:${String(seq % 60).padStart(2, '0')}.000Z`,
    updatedAt: T,
    deletedAt: null,
    syncState: 'synced',
    syncError: null,
    ...over,
  };
}

/** Base local en memoria con las cuentas dadas y un outbox que responde con `respond`. */
export function setupLedger(
  accountsList: LocalAccountRecord[],
  respond: (request: Request) => Response = () => new Response('{}', { status: 200 }),
) {
  const accounts = new MemoryAccounts();
  const ledger = new MemoryLedger(accounts);
  for (const account of accountsList) accounts.save(account);
  const queue = new MemoryOutboxStore();
  const requests: Request[] = [];
  const sender = createHttpSender(
    async (request) => {
      requests.push(request.clone());
      return respond(request);
    },
    'http://api.test',
    transactionOutboxHandlers(),
  );
  const ctx: LedgerContext = { accounts, ledger, outbox: createOutbox(queue, sender) };
  setLedgerContextForTests(() => ctx);
  refreshLedger();
  return { ctx, accounts, ledger, queue, requests };
}

export function resetLedger(): void {
  setLedgerContextForTests();
  useLedger.setState({ accounts: [], balances: {}, recent: [] });
}

/** Sesión iniciada con onboarding terminado y la moneda principal dada. */
export function signInWith({
  currency = 'COP',
  isOnline = true,
}: {
  currency?: string;
  isOnline?: boolean;
} = {}): void {
  const base = makeMe({ onboardingStep: 'done' });
  const me: Me = { ...base, profile: { ...base.profile, primaryCurrency: currency } };
  useSession.setState({ status: 'signedIn', me, accessToken: 'access', isOnline, notice: null });
}
