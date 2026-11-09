import { fromE4, toE4 } from '@saveria/shared';
import type {
  AccountRepository,
  OneTimeTokenRepository,
  ProfileRepository,
  Repositories,
  SessionRepository,
  SessionRotation,
  TransactionRepository,
  UnitOfWork,
  UserRepository,
} from '../../src/application/ports/repositories';
import type {
  Clock,
  EmailMessage,
  EmailSender,
  RateLimiter,
  RateLimitResult,
} from '../../src/application/ports/services';
import type {
  Account,
  OneTimeToken,
  OneTimeTokenKind,
  Profile,
  RevokeReason,
  Session,
  Transaction,
  User,
} from '../../src/domain/entities';

/** Almacén compartido por los repositorios en memoria y por su unidad de trabajo. */
export class InMemoryStore {
  users = new Map<string, User>();
  profiles = new Map<string, Profile>();
  sessions = new Map<string, Session>();
  tokens = new Map<string, OneTimeToken>();
  accounts = new Map<string, Account>();
  transactions = new Map<string, Transaction>();

  snapshot() {
    return structuredClone({
      users: this.users,
      profiles: this.profiles,
      sessions: this.sessions,
      tokens: this.tokens,
      accounts: this.accounts,
      transactions: this.transactions,
    });
  }

  restore(snapshot: ReturnType<InMemoryStore['snapshot']>) {
    this.users = snapshot.users;
    this.profiles = snapshot.profiles;
    this.sessions = snapshot.sessions;
    this.tokens = snapshot.tokens;
    this.accounts = snapshot.accounts;
    this.transactions = snapshot.transactions;
  }
}

/** Devuelve copias para que el código bajo prueba no modifique el almacén por referencia. */
const copy = <T>(value: T | undefined): T | null =>
  value === undefined ? null : structuredClone(value);

class InMemoryUsers implements UserRepository {
  constructor(private readonly store: InMemoryStore) {}

  async create(user: User) {
    const taken = [...this.store.users.values()].some((u) => u.email === user.email);
    if (taken || this.store.users.has(user.id)) return 'email_taken' as const;
    this.store.users.set(user.id, structuredClone(user));
    return 'created' as const;
  }
  async findById(id: string) {
    return copy(this.store.users.get(id));
  }
  async findByEmail(email: string) {
    return copy([...this.store.users.values()].find((u) => u.email === email));
  }
  async markEmailVerified(id: string, at: Date) {
    const user = this.store.users.get(id);
    if (user) Object.assign(user, { emailVerifiedAt: at, updatedAt: at });
  }
  async updatePasswordHash(id: string, passwordHash: string, at: Date) {
    const user = this.store.users.get(id);
    if (user) Object.assign(user, { passwordHash, updatedAt: at });
  }
  async updateEmail(id: string, email: string, at: Date) {
    const taken = [...this.store.users.values()].some((u) => u.email === email && u.id !== id);
    if (taken) return 'email_taken' as const;
    const user = this.store.users.get(id);
    if (user) Object.assign(user, { email, emailVerifiedAt: null, updatedAt: at });
    return 'updated' as const;
  }
  async delete(id: string) {
    this.store.users.delete(id);
    this.store.profiles.delete(id);
    for (const [key, a] of this.store.accounts)
      if (a.userId === id) this.store.accounts.delete(key);
    for (const [key, t] of this.store.transactions)
      if (t.userId === id) this.store.transactions.delete(key);
    for (const [key, t] of this.store.tokens) if (t.userId === id) this.store.tokens.delete(key);
    // Igual que ON DELETE SET NULL: las sesiones sobreviven sin usuario.
    for (const s of this.store.sessions.values()) if (s.userId === id) s.userId = null;
  }
}

class InMemoryProfiles implements ProfileRepository {
  constructor(private readonly store: InMemoryStore) {}

  async create(profile: Profile) {
    this.store.profiles.set(profile.id, structuredClone(profile));
  }
  async findById(userId: string) {
    return copy(this.store.profiles.get(userId));
  }
  async save(profile: Profile) {
    this.store.profiles.set(profile.id, structuredClone(profile));
  }
}

class InMemorySessions implements SessionRepository {
  constructor(private readonly store: InMemoryStore) {}

  async create(session: Session) {
    this.store.sessions.set(session.id, structuredClone(session));
  }
  async findById(id: string) {
    return copy(this.store.sessions.get(id));
  }
  async rotate(id: string, expectedHash: string, rotation: SessionRotation) {
    const session = this.store.sessions.get(id);
    if (!session || session.revokedAt !== null || session.refreshTokenHash !== expectedHash) {
      return false;
    }
    Object.assign(session, structuredClone(rotation));
    return true;
  }
  async revoke(id: string, reason: RevokeReason, at: Date) {
    const session = this.store.sessions.get(id);
    if (session && session.revokedAt === null) {
      Object.assign(session, { revokedAt: at, revokeReason: reason });
    }
  }
  async revokeAllForUser(userId: string, reason: RevokeReason, at: Date, exceptSessionId?: string) {
    for (const s of this.store.sessions.values()) {
      if (s.userId === userId && s.revokedAt === null && s.id !== exceptSessionId) {
        Object.assign(s, { revokedAt: at, revokeReason: reason });
      }
    }
  }
  async revokeActiveForDevice(userId: string, deviceId: string, reason: RevokeReason, at: Date) {
    for (const s of this.store.sessions.values()) {
      if (s.userId === userId && s.deviceId === deviceId && s.revokedAt === null) {
        Object.assign(s, { revokedAt: at, revokeReason: reason });
      }
    }
  }
  async markAccountDeleted(userId: string, at: Date) {
    for (const s of this.store.sessions.values()) {
      if (s.userId === userId) {
        Object.assign(s, { revokedAt: at, revokeReason: 'account_deleted', deviceName: null });
      }
    }
  }
  async purgeBefore(before: Date) {
    let deleted = 0;
    for (const [id, s] of this.store.sessions) {
      const expired = s.expiresAt < before;
      const revokedLongAgo = s.revokedAt !== null && s.revokedAt < before;
      if (expired || revokedLongAgo) {
        this.store.sessions.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }
}

class InMemoryOneTimeTokens implements OneTimeTokenRepository {
  constructor(private readonly store: InMemoryStore) {}

  async create(token: OneTimeToken) {
    const duplicated = [...this.store.tokens.values()].some((t) => t.tokenHash === token.tokenHash);
    if (duplicated) throw new Error('unique violation: token_hash');
    this.store.tokens.set(token.id, structuredClone(token));
  }
  async findByHash(tokenHash: string) {
    return copy([...this.store.tokens.values()].find((t) => t.tokenHash === tokenHash));
  }
  async invalidateActive(userId: string, kind: OneTimeTokenKind, at: Date) {
    for (const t of this.store.tokens.values()) {
      if (t.userId === userId && t.kind === kind && t.usedAt === null && t.invalidatedAt === null) {
        t.invalidatedAt = at;
      }
    }
  }
  async markUsed(id: string, at: Date) {
    const token = this.store.tokens.get(id);
    if (!token || token.usedAt !== null) return false;
    token.usedAt = at;
    return true;
  }
  async purgeBefore(before: Date) {
    let deleted = 0;
    for (const [id, t] of this.store.tokens) {
      if (t.expiresAt < before) {
        this.store.tokens.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }
}

class InMemoryAccounts implements AccountRepository {
  constructor(private readonly store: InMemoryStore) {}

  /** Imita los índices únicos parciales de PostgreSQL (data-model.md). */
  private checkUnique(account: Account) {
    const others = [...this.store.accounts.values()].filter(
      (a) => a.userId === account.userId && a.id !== account.id && a.deletedAt === null,
    );
    const active = (a: Account) => a.archivedAt === null && a.deletedAt === null;
    if (active(account) && account.isDefault && others.some((a) => active(a) && a.isDefault)) {
      throw new Error('unique violation: una cuenta por defecto por usuario');
    }
    if (
      active(account) &&
      others.some((a) => active(a) && a.name.toLowerCase() === account.name.toLowerCase())
    ) {
      throw new Error('unique violation: nombre de cuenta activa repetido');
    }
  }

  async create(account: Account) {
    this.checkUnique(account);
    this.store.accounts.set(account.id, structuredClone(account));
  }
  async upsert(account: Account) {
    this.checkUnique(account);
    this.store.accounts.set(account.id, structuredClone(account));
  }
  async findById(id: string) {
    return copy(this.store.accounts.get(id));
  }
  async findDefaultByUser(userId: string) {
    return copy(
      [...this.store.accounts.values()].find(
        (a) => a.userId === userId && a.isDefault && a.archivedAt === null && a.deletedAt === null,
      ),
    );
  }
  async listByUser(userId: string) {
    return [...this.store.accounts.values()]
      .filter((a) => a.userId === userId && a.deletedAt === null)
      .map((a) => structuredClone(a));
  }
  async clearDefaultExcept(userId: string, accountId: string, at: Date) {
    for (const a of this.store.accounts.values()) {
      if (a.userId === userId && a.id !== accountId && a.isDefault) {
        a.isDefault = false;
        a.updatedAt = at;
      }
    }
  }
}

class InMemoryTransactions implements TransactionRepository {
  constructor(private readonly store: InMemoryStore) {}

  async upsert(transaction: Transaction) {
    this.store.transactions.set(transaction.id, structuredClone(transaction));
  }
  async findById(id: string) {
    return copy(this.store.transactions.get(id));
  }
  async existsForAccount(accountId: string) {
    return [...this.store.transactions.values()].some(
      (t) => t.deletedAt === null && (t.accountId === accountId || t.toAccountId === accountId),
    );
  }
  async balanceOf(accountId: string) {
    const account = this.store.accounts.get(accountId);
    let total = toE4(account?.initialBalance ?? '0');
    for (const t of this.store.transactions.values()) {
      if (t.deletedAt !== null) continue;
      if (t.accountId === accountId) {
        total += t.type === 'income' || t.type === 'adjustment' ? toE4(t.amount) : -toE4(t.amount);
      }
      if (t.type === 'transfer' && t.toAccountId === accountId && t.toAmount !== null) {
        total += toE4(t.toAmount);
      }
    }
    return fromE4(total);
  }
}

export function createInMemoryRepositories(store: InMemoryStore): Repositories {
  return {
    users: new InMemoryUsers(store),
    profiles: new InMemoryProfiles(store),
    sessions: new InMemorySessions(store),
    oneTimeTokens: new InMemoryOneTimeTokens(store),
    accounts: new InMemoryAccounts(store),
    transactions: new InMemoryTransactions(store),
  };
}

/** Si el trabajo lanza un error, restaura el almacén como estaba (como un rollback real). */
export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(
    private readonly store: InMemoryStore,
    private readonly repos: Repositories,
  ) {}

  async run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    const snapshot = this.store.snapshot();
    try {
      return await work(this.repos);
    } catch (error) {
      this.store.restore(snapshot);
      throw error;
    }
  }
}

/** Todo el conjunto en memoria, listo para los casos de uso. */
export function createInMemoryPersistence() {
  const store = new InMemoryStore();
  const repositories = createInMemoryRepositories(store);
  return { store, repositories, uow: new InMemoryUnitOfWork(store, repositories) };
}

export class FakeEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }

  to(address: string): EmailMessage[] {
    return this.sent.filter((m) => m.to === address);
  }

  /** Extrae el valor de `token=` del último correo enviado a esa dirección. */
  lastTokenTo(address: string): string | undefined {
    const last = this.to(address).at(-1);
    return last ? /token=([A-Za-z0-9_-]+)/.exec(last.html)?.[1] : undefined;
  }
}

/** Limitador en memoria con ventana fija, controlado por el reloj de la prueba. */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly clock: Clock) {}

  private current(key: string) {
    const entry = this.counters.get(key);
    if (entry && entry.resetAt <= this.clock.now().getTime()) {
      this.counters.delete(key);
      return undefined;
    }
    return entry;
  }

  private retryAfter(entry: { resetAt: number }) {
    return Math.max(Math.ceil((entry.resetAt - this.clock.now().getTime()) / 1000), 1);
  }

  async hit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
    const entry = this.current(key) ?? {
      count: 0,
      resetAt: this.clock.now().getTime() + windowSec * 1000,
    };
    entry.count += 1;
    this.counters.set(key, entry);
    const allowed = entry.count <= limit;
    return { allowed, retryAfterSec: allowed ? 0 : this.retryAfter(entry) };
  }

  async release(key: string): Promise<void> {
    const entry = this.current(key);
    if (entry && entry.count > 0) entry.count -= 1;
  }

  async reset(key: string): Promise<void> {
    this.counters.delete(key);
  }
}
