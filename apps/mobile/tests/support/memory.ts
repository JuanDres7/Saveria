import type {
  AccountInfo,
  LocalAccount,
  LocalStore,
  ProfileFields,
} from '../../src/features/profile/local-store';
import type { OutboxItem, OutboxStore } from '../../src/outbox/outbox';

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
}
