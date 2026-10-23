import { eq } from 'drizzle-orm';
import type { UserRepository } from '../../../application/ports/repositories';
import type { User } from '../../../domain/entities';
import { users } from '../schema';
import { type DbExecutor, isUniqueViolation } from './executor';

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(user: User): Promise<'created' | 'email_taken'> {
    // ON CONFLICT DO NOTHING evita que un correo repetido aborte la transacción en curso.
    const inserted = await this.db
      .insert(users)
      .values(user)
      .onConflictDoNothing()
      .returning({ id: users.id });
    return inserted.length > 0 ? 'created' : 'email_taken';
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  }

  async markEmailVerified(id: string, at: Date): Promise<void> {
    await this.db.update(users).set({ emailVerifiedAt: at, updatedAt: at }).where(eq(users.id, id));
  }

  async updatePasswordHash(id: string, passwordHash: string, at: Date): Promise<void> {
    await this.db.update(users).set({ passwordHash, updatedAt: at }).where(eq(users.id, id));
  }

  async updateEmail(id: string, email: string, at: Date): Promise<'updated' | 'email_taken'> {
    try {
      await this.db
        .update(users)
        .set({ email, emailVerifiedAt: null, updatedAt: at })
        .where(eq(users.id, id));
      return 'updated';
    } catch (error) {
      if (isUniqueViolation(error)) return 'email_taken';
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }
}
