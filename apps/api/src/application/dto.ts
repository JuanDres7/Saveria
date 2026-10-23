import type { AiMode, OnboardingStep } from '@saveria/shared';

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
