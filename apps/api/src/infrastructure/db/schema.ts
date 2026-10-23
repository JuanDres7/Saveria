import { AI_MODES, ONBOARDING_STEPS } from '@saveria/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// Fechas siempre en timestamptz (UTC). Montos como numeric(19,4), nunca float.
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const aiModeEnum = pgEnum('ai_mode', AI_MODES);
export const onboardingStepEnum = pgEnum('onboarding_step', ONBOARDING_STEPS);
export const oneTimeTokenKindEnum = pgEnum('one_time_token_kind', [
  'email_verification',
  'password_reset',
]);
export const revokeReasonEnum = pgEnum('session_revoke_reason', [
  'logout',
  'password_changed',
  'password_reset',
  'reuse_detected',
  'replaced',
  'account_deleted',
]);

/** Identidad y credenciales. Solo la modifica el servidor. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  /** Normalizado: trim + minúsculas (FR-002) */
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerifiedAt: timestamptz('email_verified_at'),
  policyVersion: text('policy_version').notNull(),
  policyAcceptedAt: timestamptz('policy_accepted_at').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

/** Preferencias del onboarding y de Configuración. Relación 1:1 con `users`. */
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  aiName: varchar('ai_name', { length: 30 }),
  countryCode: char('country_code', { length: 2 }),
  city: varchar('city', { length: 80 }),
  primaryCurrency: char('primary_currency', { length: 3 }),
  referenceCurrencies: char('reference_currencies', { length: 3 })
    .array()
    .notNull()
    .default(sql`'{}'`),
  aiMode: aiModeEnum('ai_mode').notNull().default('manual'),
  onboardingStep: onboardingStepEnum('onboarding_step').notNull().default('ai_name'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  /** Reloj del cliente: base de la resolución de conflictos last-write-wins */
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  deletedAt: timestamptz('deleted_at'),
});

/**
 * Una fila por dispositivo con sesión iniciada. Al borrar la cuenta las sesiones NO se eliminan en
 * cascada: quedan revocadas con `account_deleted` y `user_id` en null, para que los demás
 * dispositivos sepan que deben borrar sus datos locales.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    deviceId: uuid('device_id').notNull(),
    deviceName: varchar('device_name', { length: 80 }),
    refreshTokenHash: char('refresh_token_hash', { length: 64 }).notNull(),
    previousRefreshTokenHash: char('previous_refresh_token_hash', { length: 64 }),
    rotatedAt: timestamptz('rotated_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    lastUsedAt: timestamptz('last_used_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    revokeReason: revokeReasonEnum('revoke_reason'),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

/** Enlaces de verificación y de recuperación: de un solo uso y guardados solo como hash. */
export const oneTimeTokens = pgTable(
  'one_time_tokens',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: oneTimeTokenKindEnum('kind').notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
    /** Correo al que se envió; cubre el cambio de correo sin verificar */
    targetEmail: text('target_email').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at'),
    invalidatedAt: timestamptz('invalidated_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [index('one_time_tokens_user_kind_idx').on(table.userId, table.kind)],
);

/** Cuenta de dinero. En esta feature solo se crea "Efectivo"; la feature 002 amplía esto. */
export const accounts = pgTable(
  'accounts',
  {
    /** Generado por el cliente para que la creación sea idempotente y funcione sin conexión */
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 40 }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    initialBalance: numeric('initial_balance', { precision: 19, scale: 4 }).notNull().default('0'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => [
    uniqueIndex('accounts_one_default_per_user_idx')
      .on(table.userId)
      .where(sql`${table.isDefault} AND ${table.deletedAt} IS NULL`),
  ],
);
