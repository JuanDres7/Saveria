import { AI_MODES, ONBOARDING_STEPS } from '@saveria/shared';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Base local de un usuario (SQLite cifrado con SQLCipher, un archivo por usuario).
 * Las fechas se guardan como texto ISO 8601 en UTC; los montos como texto decimal exacto.
 */

/** Copia local del perfil. Una sola fila: la del usuario. */
export const profile = sqliteTable('profile', {
  id: text('id').primaryKey(),
  aiName: text('ai_name'),
  countryCode: text('country_code'),
  city: text('city'),
  primaryCurrency: text('primary_currency'),
  referenceCurrencies: text('reference_currencies', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  aiMode: text('ai_mode', { enum: AI_MODES }).notNull().default('manual'),
  onboardingStep: text('onboarding_step', { enum: ONBOARDING_STEPS }).notNull().default('ai_name'),
  /** Reloj del dispositivo: base de la resolución last-write-wins con el servidor */
  updatedAt: text('updated_at').notNull(),
});

/** Copia local de las cuentas de dinero. */
export const accounts = sqliteTable('accounts', {
  /** UUID generado en el dispositivo: la creación es idempotente y funciona sin conexión */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  currency: text('currency').notNull(),
  initialBalance: text('initial_balance').notNull().default('0'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

/**
 * Cola de cambios pendientes de enviar al servidor. Las features siguientes (movimientos,
 * sincronización) usan esta misma tabla.
 */
export const outbox = sqliteTable('outbox', {
  id: text('id').primaryKey(),
  /** Qué se cambió: `profile`, `onboarding`, … */
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  /** Qué se hizo: `upsert`, `complete`, … */
  operation: text('operation').notNull(),
  payload: text('payload', { mode: 'json' }).$type<unknown>().notNull(),
  /** Milisegundos desde 1970; define el orden de envío */
  createdAt: integer('created_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  /** No se reintenta antes de este instante (backoff). 0 = ya se puede enviar */
  nextAttemptAt: integer('next_attempt_at').notNull().default(0),
});

/** Clave-valor: estado de verificación, última comprobación con el servidor, etc. */
export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
