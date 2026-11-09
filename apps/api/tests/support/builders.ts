import type { Account, OneTimeToken, Profile, Session, User } from '../../src/domain/entities';

const NOW = new Date('2026-10-22T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

let counter = 0;
/** UUID con forma v7 y único dentro de la corrida de pruebas. */
export function testId(): string {
  counter += 1;
  return `0199a1b2-0000-7000-8000-${counter.toString(16).padStart(12, '0')}`;
}

export function makeUser(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? testId();
  return {
    id,
    email: `${id}@mail.com`,
    passwordHash: '$2b$12$hash-de-prueba',
    emailVerifiedAt: null,
    policyVersion: '2026-10-v1',
    policyAcceptedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeProfile(userId: string, overrides: Partial<Profile> = {}): Profile {
  return {
    id: userId,
    aiName: null,
    countryCode: null,
    city: null,
    primaryCurrency: null,
    referenceCurrencies: [],
    aiMode: 'manual',
    onboardingStep: 'ai_name',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

export function makeSession(userId: string | null, overrides: Partial<Session> = {}): Session {
  return {
    id: testId(),
    userId,
    deviceId: testId(),
    deviceName: 'Pixel de prueba',
    refreshTokenHash: 'a'.repeat(64),
    previousRefreshTokenHash: null,
    rotatedAt: null,
    createdAt: NOW,
    lastUsedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 30 * DAY),
    revokedAt: null,
    revokeReason: null,
    ...overrides,
  };
}

export function makeToken(userId: string, overrides: Partial<OneTimeToken> = {}): OneTimeToken {
  const id = overrides.id ?? testId();
  return {
    id,
    userId,
    kind: 'email_verification',
    tokenHash: id.replace(/-/g, '').padEnd(64, 'b'),
    targetEmail: 'ana@mail.com',
    expiresAt: new Date(NOW.getTime() + DAY),
    usedAt: null,
    invalidatedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

export function makeAccount(userId: string, overrides: Partial<Account> = {}): Account {
  return {
    id: testId(),
    userId,
    name: 'Efectivo',
    currency: 'COP',
    initialBalance: '0',
    isDefault: true,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}
