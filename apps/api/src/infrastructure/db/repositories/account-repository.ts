import { and, eq, isNull, ne } from 'drizzle-orm';
import type { AccountRepository } from '../../../application/ports/repositories';
import { normalizeDecimal } from '../../../application/use-cases/get-me';
import type { Account } from '../../../domain/entities';
import { accounts } from '../schema';
import type { DbExecutor } from './executor';

const toAccount = (row: typeof accounts.$inferSelect): Account => ({
  ...row,
  initialBalance: normalizeDecimal(row.initialBalance),
});

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(account: Account): Promise<void> {
    await this.db.insert(accounts).values(account);
  }

  async upsert(account: Account): Promise<void> {
    const { id, userId, createdAt, ...fields } = account;
    await this.db
      .insert(accounts)
      .values(account)
      .onConflictDoUpdate({ target: accounts.id, set: fields });
  }

  async findById(id: string): Promise<Account | null> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    return row ? toAccount(row) : null;
  }

  async findDefaultByUser(userId: string): Promise<Account | null> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.isDefault, true),
          isNull(accounts.archivedAt),
          isNull(accounts.deletedAt),
        ),
      )
      .limit(1);
    return row ? toAccount(row) : null;
  }

  async listByUser(userId: string): Promise<Account[]> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)));
    return rows.map(toAccount);
  }

  async clearDefaultExcept(userId: string, accountId: string, at: Date): Promise<void> {
    await this.db
      .update(accounts)
      .set({ isDefault: false, updatedAt: at })
      .where(
        and(eq(accounts.userId, userId), ne(accounts.id, accountId), eq(accounts.isDefault, true)),
      );
  }
}
