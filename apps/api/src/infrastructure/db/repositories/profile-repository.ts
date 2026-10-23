import { eq } from 'drizzle-orm';
import type { ProfileRepository } from '../../../application/ports/repositories';
import type { Profile } from '../../../domain/entities';
import { userProfiles } from '../schema';
import type { DbExecutor } from './executor';

export class DrizzleProfileRepository implements ProfileRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(profile: Profile): Promise<void> {
    await this.db.insert(userProfiles).values(profile);
  }

  async findById(userId: string): Promise<Profile | null> {
    const [row] = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1);
    return row ?? null;
  }

  async save(profile: Profile): Promise<void> {
    await this.db
      .update(userProfiles)
      .set({
        aiName: profile.aiName,
        countryCode: profile.countryCode,
        city: profile.city,
        primaryCurrency: profile.primaryCurrency,
        referenceCurrencies: profile.referenceCurrencies,
        aiMode: profile.aiMode,
        onboardingStep: profile.onboardingStep,
        updatedAt: profile.updatedAt,
        deletedAt: profile.deletedAt,
      })
      .where(eq(userProfiles.id, profile.id));
  }
}
