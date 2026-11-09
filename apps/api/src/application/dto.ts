import type { AccountType, AiMode, OnboardingStep, TransactionType } from '@saveria/shared';

/**
 * Formas de respuesta del contrato (contracts/openapi.yaml). Se arman campo por campo a partir de
 * las entidades: nunca se esparce una entidad, para no filtrar datos como `passwordHash`.
 */

export interface TokenPairDto {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
}

export interface ProfileDto {
  aiName: string | null;
  countryCode: string | null;
  city: string | null;
  primaryCurrency: string | null;
  referenceCurrencies: string[];
  aiMode: AiMode;
  onboardingStep: OnboardingStep;
  updatedAt: string;
}

export interface AccountDto {
  id: string;
  name: string;
  currency: string;
  initialBalance: string;
  isDefault: boolean;
}

/** Cuenta completa (contrato AccountRecord); `AccountDto` es la versión corta de `Me`. */
export interface AccountRecordDto {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: string;
  isDefault: boolean;
  archivedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface TransactionDto {
  id: string;
  type: TransactionType;
  accountId: string;
  amount: string;
  currency: string;
  toAccountId: string | null;
  toAmount: string | null;
  toCurrency: string | null;
  categorySlug: string | null;
  description: string | null;
  occurredOn: string;
  deletedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface MeDto {
  id: string;
  email: string;
  emailVerified: boolean;
  verificationDeadline: string;
  verificationRequired: boolean;
  profile: ProfileDto;
  defaultAccount: AccountDto | null;
}

export interface AuthResponseDto {
  tokens: TokenPairDto;
  me: MeDto;
}

/** Dispositivo desde el que se inicia sesión. */
export interface DeviceInput {
  id: string;
  name?: string | null;
}
