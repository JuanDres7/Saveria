import type { AccountType, AiMode, OnboardingStep, TransactionType } from '@saveria/shared';

export interface User {
  id: string;
  /** Normalizado: sin espacios y en minúsculas */
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  policyVersion: string;
  policyAcceptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Preferencias del usuario. Su `id` es el del usuario (relación 1:1). */
export interface Profile {
  id: string;
  aiName: string | null;
  countryCode: string | null;
  city: string | null;
  primaryCurrency: string | null;
  referenceCurrencies: string[];
  aiMode: AiMode;
  onboardingStep: OnboardingStep;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type RevokeReason =
  | 'logout'
  | 'password_changed'
  | 'password_reset'
  | 'reuse_detected'
  | 'replaced'
  | 'account_deleted';

export interface Session {
  id: string;
  /** `null` cuando la cuenta fue borrada */
  userId: string | null;
  deviceId: string;
  deviceName: string | null;
  refreshTokenHash: string;
  previousRefreshTokenHash: string | null;
  rotatedAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokeReason: RevokeReason | null;
}

export type OneTimeTokenKind = 'email_verification' | 'password_reset';

export interface OneTimeToken {
  id: string;
  userId: string;
  kind: OneTimeTokenKind;
  tokenHash: string;
  targetEmail: string;
  expiresAt: Date;
  usedAt: Date | null;
  invalidatedAt: Date | null;
  createdAt: Date;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currency: string;
  /** Decimal exacto como texto, nunca número de punto flotante */
  initialBalance: string;
  isDefault: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Gasto, ingreso, transferencia (origen + destino en una fila) o ajuste (monto con signo). */
export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  accountId: string;
  /** Decimal exacto como texto */
  amount: string;
  currency: string;
  toAccountId: string | null;
  toAmount: string | null;
  toCurrency: string | null;
  categorySlug: string | null;
  description: string | null;
  /** Día local del movimiento, `YYYY-MM-DD` */
  occurredOn: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
