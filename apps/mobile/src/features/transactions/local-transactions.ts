import { fromE4 } from '@saveria/shared';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { UserDb } from '../../db/open-user-db';
import { type SyncState, transactions } from '../../db/schema';
import { e4Value } from '../accounts/local-accounts';

/** Un movimiento en la base local, con su estado de envío. */
export type LocalTransactionRecord = Omit<
  typeof transactions.$inferSelect,
  'amountE4' | 'toAmountE4'
>;

export const HISTORY_PAGE_SIZE = 50;

const columns = {
  id: transactions.id,
  type: transactions.type,
  accountId: transactions.accountId,
  amount: transactions.amount,
  currency: transactions.currency,
  toAccountId: transactions.toAccountId,
  toAmount: transactions.toAmount,
  toCurrency: transactions.toCurrency,
  categorySlug: transactions.categorySlug,
  description: transactions.description,
  occurredOn: transactions.occurredOn,
  createdAt: transactions.createdAt,
  updatedAt: transactions.updatedAt,
  deletedAt: transactions.deletedAt,
  syncState: transactions.syncState,
  syncError: transactions.syncError,
};

/** Movimientos del usuario en su base local cifrada, y los saldos calculados con ellos. */
export class LocalTransactions {
  constructor(private readonly db: UserDb) {}

  save(record: LocalTransactionRecord): void {
    const { id, createdAt, ...fields } = record;
    const values = {
      ...fields,
      amountE4: e4Value(record.amount),
      toAmountE4: record.toAmount === null ? null : e4Value(record.toAmount),
    };
    this.db
      .insert(transactions)
      .values({ id, createdAt, ...values })
      .onConflictDoUpdate({ target: transactions.id, set: values })
      .run();
  }

  findById(id: string): LocalTransactionRecord | null {
    return this.db.select(columns).from(transactions).where(eq(transactions.id, id)).get() ?? null;
  }

  /** Borrado lógico: el movimiento deja de contar en los saldos y en el historial. */
  softDelete(id: string, at: string): void {
    this.db
      .update(transactions)
      .set({ deletedAt: at, updatedAt: at, syncState: 'pending', syncError: null })
      .where(eq(transactions.id, id))
      .run();
  }

  /** "Deshacer" un borrado, o volver a mostrar un borrado que el servidor rechazó. */
  restore(id: string, at: string): void {
    this.db
      .update(transactions)
      .set({ deletedAt: null, updatedAt: at })
      .where(eq(transactions.id, id))
      .run();
  }

  markSync(id: string, syncState: SyncState, syncError: string | null = null): void {
    this.db.update(transactions).set({ syncState, syncError }).where(eq(transactions.id, id)).run();
  }

  /** Si la cuenta tiene movimientos vivos, como origen o como destino (FR-019). */
  existsForAccount(accountId: string): boolean {
    const row = this.db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          isNull(transactions.deletedAt),
          or(eq(transactions.accountId, accountId), eq(transactions.toAccountId, accountId)),
        ),
      )
      .limit(1)
      .get();
    return row !== undefined;
  }

  /**
   * Saldo de cada cuenta (data-model.md): saldo inicial + ingresos − gastos ± ajustes −
   * transferencias que salen + transferencias que entran, sin los borrados. Se suma en SQL sobre
   * enteros en diezmilésimas y se lee como texto, así nunca pasa por un `number` (research §5).
   */
  balances(): Map<string, string> {
    const rows = this.db.all<{ id: string; balance: string }>(sql`
      select a.id as id, cast(
        a.initial_balance_e4
        + coalesce((
            select sum(case when t.type in ('income', 'adjustment') then t.amount_e4 else -t.amount_e4 end)
            from transactions t
            where t.account_id = a.id and t.deleted_at is null
          ), 0)
        + coalesce((
            select sum(t.to_amount_e4)
            from transactions t
            where t.to_account_id = a.id and t.type = 'transfer' and t.deleted_at is null
          ), 0)
        as text) as balance
      from accounts a
      where a.deleted_at is null
    `);
    return new Map(rows.map((row) => [row.id, fromE4(BigInt(row.balance))]));
  }

  /**
   * Historial del más reciente al más antiguo (por día y, dentro del día, por hora de registro),
   * de 50 en 50. Con `accountId` incluye también las transferencias que entran a esa cuenta.
   */
  history({
    accountId,
    limit = HISTORY_PAGE_SIZE,
    offset = 0,
  }: {
    accountId?: string;
    limit?: number;
    offset?: number;
  } = {}): LocalTransactionRecord[] {
    const live = isNull(transactions.deletedAt);
    return this.db
      .select(columns)
      .from(transactions)
      .where(
        accountId === undefined
          ? live
          : and(
              live,
              or(eq(transactions.accountId, accountId), eq(transactions.toAccountId, accountId)),
            ),
      )
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt), desc(transactions.id))
      .limit(limit)
      .offset(offset)
      .all();
  }
}
