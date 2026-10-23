import { and, eq, isNull, lt } from 'drizzle-orm';
import type { OneTimeTokenRepository } from '../../../application/ports/repositories';
import type { OneTimeToken, OneTimeTokenKind } from '../../../domain/entities';
import { oneTimeTokens } from '../schema';
import type { DbExecutor } from './executor';

export class DrizzleOneTimeTokenRepository implements OneTimeTokenRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(token: OneTimeToken): Promise<void> {
    await this.db.insert(oneTimeTokens).values(token);
  }

  async findByHash(tokenHash: string): Promise<OneTimeToken | null> {
    const [row] = await this.db
      .select()
      .from(oneTimeTokens)
      .where(eq(oneTimeTokens.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async invalidateActive(userId: string, kind: OneTimeTokenKind, at: Date): Promise<void> {
    await this.db
      .update(oneTimeTokens)
      .set({ invalidatedAt: at })
      .where(
        and(
          eq(oneTimeTokens.userId, userId),
          eq(oneTimeTokens.kind, kind),
          isNull(oneTimeTokens.usedAt),
          isNull(oneTimeTokens.invalidatedAt),
        ),
      );
  }

  async markUsed(id: string, at: Date): Promise<void> {
    await this.db.update(oneTimeTokens).set({ usedAt: at }).where(eq(oneTimeTokens.id, id));
  }

  async purgeBefore(before: Date): Promise<number> {
    const deleted = await this.db
      .delete(oneTimeTokens)
      .where(lt(oneTimeTokens.expiresAt, before))
      .returning({ id: oneTimeTokens.id });
    return deleted.length;
  }
}
