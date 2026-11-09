import { ACCOUNT_TYPES, AI_MODES, ONBOARDING_STEPS, TRANSACTION_TYPES } from '@saveria/shared';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

/** Estado del envío al servidor de una cuenta o un movimiento (FR-037). */
export const SYNC_STATES = ['pending', 'synced', 'rejected'] as const;
export type SyncState = (typeof SYNC_STATES)[number];

/**
 * Copia local de las cuentas de dinero. Los montos se guardan dos veces: como texto (el valor
 * canónico) y como entero en diezmilésimas (`*_e4`), que es lo que suman las consultas de saldo
 * sin punto flotante (research §5). Los `*_e4` se escriben con `CAST(texto AS INTEGER)` y se leen
 * sumados como texto, porque un `number` de JS no alcanza para todos los montos.
 */
export const accounts = sqliteTable('accounts', {
  /** UUID generado en el dispositivo: la creación es idempotente y funciona sin conexión */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ACCOUNT_TYPES }).notNull().default('cash'),
  currency: text('currency').notNull(),
  initialBalance: text('initial_balance').notNull().default('0'),
  /** En la 001 solo existía "Efectivo" con saldo inicial 0: el valor por defecto es exacto */
  initialBalanceE4: integer('initial_balance_e4').notNull().default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncState: text('sync_state', { enum: SYNC_STATES }).notNull().default('synced'),
  syncError: text('sync_error'),
});

/** Copia local de los movimientos (data-model.md, base local). */
export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: TRANSACTION_TYPES }).notNull(),
    accountId: text('account_id').notNull(),
    amount: text('amount').notNull(),
    amountE4: integer('amount_e4').notNull(),
    currency: text('currency').notNull(),
    toAccountId: text('to_account_id'),
    toAmount: text('to_amount'),
    toAmountE4: integer('to_amount_e4'),
    toCurrency: text('to_currency'),
    categorySlug: text('category_slug'),
    description: text('description'),
    /** Día local, `YYYY-MM-DD` */
    occurredOn: text('occurred_on').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
    syncState: text('sync_state', { enum: SYNC_STATES }).notNull().default('pending'),
    syncError: text('sync_error'),
  },
  (table) => [
    index('transactions_occurred_idx').on(table.occurredOn, table.createdAt),
    index('transactions_account_idx').on(table.accountId),
    index('transactions_to_account_idx').on(table.toAccountId),
  ],
);

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
