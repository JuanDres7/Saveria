import type { Account, Profile, User } from '../../domain/entities';
import { DomainError } from '../../domain/errors';
import type { AccountDto, MeDto, ProfileDto } from '../dto';
import type { AccountRepository, ProfileRepository, UserRepository } from '../ports/repositories';
import type { Clock } from '../ports/services';

/** Plazo para verificar el correo antes de que la app muestre el bloqueo (FR-032). */
export const VERIFICATION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function toProfileDto(profile: Profile): ProfileDto {
  return {
    aiName: profile.aiName,
    countryCode: profile.countryCode,
    city: profile.city,
    primaryCurrency: profile.primaryCurrency,
    referenceCurrencies: profile.referenceCurrencies,
    aiMode: profile.aiMode,
    onboardingStep: profile.onboardingStep,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export function toAccountDto(account: Account): AccountDto {
  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    initialBalance: account.initialBalance,
    isDefault: account.isDefault,
  };
}

export function toMe(
  user: User,
  profile: Profile,
  defaultAccount: Account | null,
  now: Date,
): MeDto {
  const deadline = new Date(user.createdAt.getTime() + VERIFICATION_GRACE_MS);
  const emailVerified = user.emailVerifiedAt !== null;
  return {
    id: user.id,
    email: user.email,
    emailVerified,
    verificationDeadline: deadline.toISOString(),
    verificationRequired: !emailVerified && now.getTime() > deadline.getTime(),
    profile: toProfileDto(profile),
    defaultAccount: defaultAccount ? toAccountDto(defaultAccount) : null,
  };
}

export interface GetMeDeps {
  repositories: {
    users: UserRepository;
    profiles: ProfileRepository;
    accounts: AccountRepository;
  };
  clock: Clock;
}

export function createGetMe({ repositories, clock }: GetMeDeps) {
  return async function getMe(userId: string): Promise<MeDto> {
    const [user, profile, account] = await Promise.all([
      repositories.users.findById(userId),
      repositories.profiles.findById(userId),
      repositories.accounts.findDefaultByUser(userId),
    ]);
    // El middleware ya validó la sesión; si el usuario no está, la sesión no debería servir.
    if (!user || !profile) throw new DomainError('unauthorized');
    return toMe(user, profile, account, clock.now());
  };
}
