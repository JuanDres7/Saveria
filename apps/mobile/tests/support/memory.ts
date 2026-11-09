import { fromE4, toE4 } from '@saveria/shared';
import type { SyncState } from '../../src/db/schema';
import type { LocalAccountRecord } from '../../src/features/accounts/local-accounts';
import type {
  AccountInfo,
  LocalAccount,
  LocalStore,
  ProfileFields,
} from '../../src/features/profile/local-store';
import type { AccountsStore, LedgerStore } from '../../src/features/transactions/ledger';
import type { LocalTransactionRecord } from '../../src/features/transactions/local-transactions';
import type { NewOutboxItem, OutboxItem, OutboxStore } from '../../src/outbox/outbox';

/** Base local en memoria: perfil y cuentas de un usuario. */
export class MemoryLocalStore implements LocalStore {
  profiles = new Map<string, ProfileFields>();
  accounts: LocalAccount[] = [];

  readProfile(userId: string) {
    const profile = this.profiles.get(userId);
    return profile ? structuredClone(profile) : null;
  }
  writeProfile(userId: string, profile: ProfileFields) {
    this.profiles.set(userId, structuredClone(profile));
  }
  readDefaultAccount() {
    return this.accounts.find((a) => a.isDefault) ?? null;
  }
  writeAccount(account: LocalAccount) {
    this.accounts = [...this.accounts.filter((a) => a.id !== account.id), { ...account }];
  }
  accountInfo: AccountInfo | null = null;
  readAccountInfo() {
    return this.accountInfo ? { ...this.accountInfo } : null;
  }
  writeAccountInfo(info: AccountInfo) {
    this.accountInfo = { ...info };
  }
}

/** Cola del outbox en memoria. */
export class MemoryOutboxStore implements OutboxStore {
  items: OutboxItem[] = [];
  insert(item: OutboxItem) {
    this.items.push({ ...item });
  }
  oldest() {
    const sorted = [...this.items].sort((a, b) => a.createdAt - b.createdAt);
    return sorted[0] ? { ...sorted[0] } : null;
  }
  remove(id: string) {
    this.items = this.items.filter((i) => i.id !== id);
  }
  markFailed(id: string, error: string, nextAttemptAt: number) {
    const item = this.items.find((i) => i.id === id);
    if (item) Object.assign(item, { attempts: item.attempts + 1, lastError: error, nextAttemptAt });
  }
  count() {
    return this.items.length;
  }
  replacePending(change: NewOutboxItem, exceptId: string | null) {
    const pending = this.items
      .filter(
        (i) => i.entity === change.entity && i.entityId === change.entityId && i.id !== exceptId,
      )
      .sort((a, b) => a.createdAt - b.createdAt);
    const [first, ...rest] = pending;
    if (!first) return null;
    Object.assign(first, {
      operation: change.operation,
      payload: change.payload,
      attempts: 0,
      lastError: null,
      nextAttemptAt: 0,
    });
    this.items = this.items.filter((i) => !rest.includes(i));
    return first.id;
  }
}

/** Cuentas de dinero en memoria, con las mismas operaciones que `LocalAccounts`. */
export class MemoryAccounts implements AccountsStore {
  rows: LocalAccountRecord[] = [];
  list() {
    return this.rows.filter((a) => a.deletedAt === null).map((a) => ({ ...a }));
  }
  findById(id: string) {
    const row = this.rows.find((a) => a.id === id);
    return row ? { ...row } : null;
  }
  save(record: LocalAccountRecord) {
    this.rows = [...this.rows.filter((a) => a.id !== record.id), { ...record }];
  }
  clearDefaultExcept(id: string, updatedAt: string) {
    for (const a of this.rows)
      if (a.id !== id && a.isDefault) Object.assign(a, { isDefault: false, updatedAt });
  }
  markSync(id: string, syncState: SyncState, syncError: string | null = null) {
    const row = this.rows.find((a) => a.id === id);
    if (row) Object.assign(row, { syncState, syncError });
  }
}

/** Movimientos en memoria; los saldos se suman con enteros, como en SQLite. */
export class MemoryLedger implements LedgerStore {
  constructor(private readonly accounts: MemoryAccounts) {}
  rows: LocalTransactionRecord[] = [];
  save(record: LocalTransactionRecord) {
    this.rows = [...this.rows.filter((t) => t.id !== record.id), { ...record }];
  }
  findById(id: string) {
    const row = this.rows.find((t) => t.id === id);
    return row ? { ...row } : null;
  }
  softDelete(id: string, at: string) {
    const row = this.rows.find((t) => t.id === id);
    if (row)
      Object.assign(row, { deletedAt: at, updatedAt: at, syncState: 'pending', syncError: null });
  }
  restore(id: string, at: string) {
    const row = this.rows.find((t) => t.id === id);
    if (row) Object.assign(row, { deletedAt: null, updatedAt: at });
  }
  markSync(id: string, syncState: SyncState, syncError: string | null = null) {
    const row = this.rows.find((t) => t.id === id);
    if (row) Object.assign(row, { syncState, syncError });
  }
  existsForAccount(accountId: string) {
    return this.rows.some(
      (t) => t.deletedAt === null && (t.accountId === accountId || t.toAccountId === accountId),
    );
  }
  balances() {
    const result = new Map<string, string>();
    for (const account of this.accounts.list()) {
      let total = toE4(account.initialBalance);
      for (const t of this.rows) {
        if (t.deletedAt !== null) continue;
        if (t.accountId === account.id) {
          total +=
            t.type === 'income' || t.type === 'adjustment' ? toE4(t.amount) : -toE4(t.amount);
        }
        if (t.type === 'transfer' && t.toAccountId === account.id && t.toAmount !== null) {
          total += toE4(t.toAmount);
        }
      }
      result.set(account.id, fromE4(total));
    }
    return result;
  }
  history({
    accountId,
    limit = 50,
    offset = 0,
  }: {
    accountId?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    return this.rows
      .filter(
        (t) =>
          t.deletedAt === null &&
          (accountId === undefined || t.accountId === accountId || t.toAccountId === accountId),
      )
      .sort(
        (a, b) =>
          b.occurredOn.localeCompare(a.occurredOn) ||
          b.createdAt.localeCompare(a.createdAt) ||
          b.id.localeCompare(a.id),
      )
      .slice(offset, offset + limit)
      .map((t) => ({ ...t }));
  }
}
