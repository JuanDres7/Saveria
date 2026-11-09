import { toE4 } from '@saveria/shared';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { UserDb } from '../../db/open-user-db';
import { accounts, type SyncState } from '../../db/schema';

/** Una cuenta de dinero en la base local, con su estado de envío. */
export type LocalAccountRecord = Omit<typeof accounts.$inferSelect, 'initialBalanceE4'>;

/** Texto decimal → expresión SQL que guarda el entero exacto en diezmilésimas (research §5). */
export const e4Value = (amount: string) => sql`CAST(${toE4(amount).toString()} AS INTEGER)`;

const columns = {
  id: accounts.id,
  name: accounts.name,
  type: accounts.type,
  currency: accounts.currency,
  initialBalance: accounts.initialBalance,
  isDefault: accounts.isDefault,
  archivedAt: accounts.archivedAt,
  createdAt: accounts.createdAt,
  updatedAt: accounts.updatedAt,
  deletedAt: accounts.deletedAt,
  syncState: accounts.syncState,
  syncError: accounts.syncError,
};

/** Cuentas de dinero del usuario en su base local cifrada. Sin red: todo es inmediato. */
export class LocalAccounts {
  constructor(private readonly db: UserDb) {}

  /** Activas y archivadas, sin las borradas, en orden de creación. */
  list(): LocalAccountRecord[] {
    return this.db
      .select(columns)
      .from(accounts)
      .where(isNull(accounts.deletedAt))
      .orderBy(asc(accounts.createdAt), asc(accounts.id))
      .all();
  }

  findById(id: string): LocalAccountRecord | null {
    return this.db.select(columns).from(accounts).where(eq(accounts.id, id)).get() ?? null;
  }

  save(record: LocalAccountRecord): void {
    const { id, createdAt, ...fields } = record;
    const values = { ...fields, initialBalanceE4: e4Value(record.initialBalance) };
    this.db
      .insert(accounts)
      .values({ id, createdAt, ...values })
      .onConflictDoUpdate({ target: accounts.id, set: values })
      .run();
  }

  /** Quita la marca de cuenta por defecto a las demás (igual que el servidor). */
  clearDefaultExcept(id: string, updatedAt: string): void {
    this.db
      .update(accounts)
      .set({ isDefault: false, updatedAt })
      .where(and(ne(accounts.id, id), eq(accounts.isDefault, true)))
      .run();
  }

  markSync(id: string, syncState: SyncState, syncError: string | null = null): void {
    this.db.update(accounts).set({ syncState, syncError }).where(eq(accounts.id, id)).run();
  }
}
