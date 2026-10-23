import { and, eq, isNull, lt, ne, or } from 'drizzle-orm';
import type { SessionRepository } from '../../../application/ports/repositories';
import type { RevokeReason, Session } from '../../../domain/entities';
import { sessions } from '../schema';
import type { DbExecutor } from './executor';

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(session: Session): Promise<void> {
    await this.db.insert(sessions).values(session);
  }

  async findById(id: string): Promise<Session | null> {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return row ?? null;
  }

  async save(session: Session): Promise<void> {
    const { id, ...fields } = session;
    await this.db.update(sessions).set(fields).where(eq(sessions.id, id));
  }

  async revoke(id: string, reason: RevokeReason, at: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: at, revokeReason: reason })
      .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)));
  }

  async revokeAllForUser(
    userId: string,
    reason: RevokeReason,
    at: Date,
    exceptSessionId?: string,
  ): Promise<void> {
    const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
    if (exceptSessionId) conditions.push(ne(sessions.id, exceptSessionId));
    await this.db
      .update(sessions)
      .set({ revokedAt: at, revokeReason: reason })
      .where(and(...conditions));
  }

  async revokeActiveForDevice(
    userId: string,
    deviceId: string,
    reason: RevokeReason,
    at: Date,
  ): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: at, revokeReason: reason })
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.deviceId, deviceId),
          isNull(sessions.revokedAt),
        ),
      );
  }

  async markAccountDeleted(userId: string, at: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: at, revokeReason: 'account_deleted', deviceName: null })
      .where(eq(sessions.userId, userId));
  }

  async purgeBefore(before: Date): Promise<number> {
    const deleted = await this.db
      .delete(sessions)
      .where(or(lt(sessions.expiresAt, before), lt(sessions.revokedAt, before)))
      .returning({ id: sessions.id });
    return deleted.length;
  }
}
