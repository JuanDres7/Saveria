import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { TransactionRepository } from '../../../application/ports/repositories';
import { normalizeDecimal } from '../../../application/use-cases/get-me';
import type { Transaction } from '../../../domain/entities';
import { accounts, transactions } from '../schema';
import type { DbExecutor } from './executor';

const toTransaction = (row: typeof transactions.$inferSelect): Transaction => ({
  ...row,
  amount: normalizeDecimal(row.amount),
  toAmount: row.toAmount === null ? null : normalizeDecimal(row.toAmount),
});

export class DrizzleTransactionRepository implements TransactionRepository {
  constructor(private readonly db: DbExecutor) {}

  async upsert(transaction: Transaction): Promise<void> {
    const { id, userId, createdAt, ...fields } = transaction;
    await this.db
      .insert(transactions)
      .values(transaction)
      .onConflictDoUpdate({ target: transactions.id, set: fields });
  }

  async findById(id: string): Promise<Transaction | null> {
    const [row] = await this.db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    return row ? toTransaction(row) : null;
  }

  async existsForAccount(accountId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          isNull(transactions.deletedAt),
          or(eq(transactions.accountId, accountId), eq(transactions.toAccountId, accountId)),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async balanceOf(accountId: string): Promise<string> {
    // La suma se hace en SQL sobre numeric: exacta, sin pasar por números de JS. `accounts.id` va
    // escrito a mano: dentro de la subconsulta Drizzle lo dejaría como "id" y apuntaría a `t.id`.
    const [row] = await this.db
      .select({
        balance: sql<string>`${accounts.initialBalance}
          + coalesce((
              select sum(case when t.type in ('income', 'adjustment') then t.amount else -t.amount end)
              from ${transactions} t
              where t.account_id = accounts.id and t.deleted_at is null
            ), 0)
          + coalesce((
              select sum(t.to_amount)
              from ${transactions} t
              where t.to_account_id = accounts.id and t.type = 'transfer' and t.deleted_at is null
            ), 0)`,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    return normalizeDecimal(row?.balance ?? '0');
  }
}
