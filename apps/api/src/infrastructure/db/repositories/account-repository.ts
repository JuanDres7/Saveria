import { and, eq, isNull } from 'drizzle-orm';
import type { AccountRepository } from '../../../application/ports/repositories';
import type { Account } from '../../../domain/entities';
import { accounts } from '../schema';
import type { DbExecutor } from './executor';

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(account: Account): Promise<void> {
    await this.db.insert(accounts).values(account);
  }

  async findById(id: string): Promise<Account | null> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    return row ?? null;
  }

  async findDefaultByUser(userId: string): Promise<Account | null> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.userId, userId), eq(accounts.isDefault, true), isNull(accounts.deletedAt)),
      )
      .limit(1);
    return row ?? null;
  }
}
