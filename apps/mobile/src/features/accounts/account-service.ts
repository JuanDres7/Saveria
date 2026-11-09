import {
  type AccountRuleView,
  type AccountType,
  accountInputSchema,
  checkAccountChange,
  parseAmount,
} from '@saveria/shared';
import * as Crypto from 'expo-crypto';
import type { OutboxItem } from '../../outbox/outbox';
import { onOutboxConflict, onOutboxRejected, onOutboxSent } from '../../outbox/user-outbox';
import {
  flushIfOnline,
  type LedgerContext,
  openLedgerContext,
  refreshLedger,
  rejectionMessage,
} from '../transactions/ledger';
import type { LocalAccountRecord } from './local-accounts';

/** Lo que llena el formulario de cuenta. El saldo llega tal como lo escribió el usuario. */
export interface AccountForm {
  name: string;
  type: AccountType;
  currency: string;
  initialBalanceText: string;
}

export type AccountResult =
  | { ok: true; account: LocalAccountRecord }
  | { ok: false; errors: Record<string, string> };

export interface AccountServiceDeps {
  context(): LedgerContext | null;
  now(): number;
  newId(): string;
}

/** La cuenta completa que se envía en `PUT /v1/accounts/{id}` (contrato AccountInput). */
export type AccountPayload = Pick<
  LocalAccountRecord,
  'name' | 'type' | 'currency' | 'initialBalance' | 'isDefault' | 'archivedAt' | 'updatedAt'
>;

function toPayload(record: LocalAccountRecord): AccountPayload {
  const { name, type, currency, initialBalance, isDefault, archivedAt, updatedAt } = record;
  return { name, type, currency, initialBalance, isDefault, archivedAt, updatedAt };
}

const ruleView = (a: LocalAccountRecord): AccountRuleView => ({
  id: a.id,
  name: a.name,
  currency: a.currency,
  isDefault: a.isDefault,
  archivedAt: a.archivedAt,
});

export function createAccountService({ context, now, newId }: AccountServiceDeps) {
  function requireContext(): LedgerContext {
    const ctx = context();
    if (!ctx) throw new Error('No hay una sesión con la base local abierta');
    return ctx;
  }

  /** Siempre más nuevo que lo guardado, aunque el reloj del teléfono vaya atrasado. */
  function nextUpdatedAt(previous: LocalAccountRecord | null): string {
    const floor = previous ? Date.parse(previous.updatedAt) + 1 : 0;
    return new Date(Math.max(now(), floor)).toISOString();
  }

  /**
   * Valida con las mismas reglas que el servidor (Constitución I: `accountInputSchema` y
   * `checkAccountChange` de `@saveria/shared`), guarda en el teléfono, encola el registro
   * completo y lo envía si hay red.
   */
  function save(ctx: LedgerContext, next: LocalAccountRecord, previous: LocalAccountRecord | null) {
    const parsed = accountInputSchema.safeParse(toPayload(next));
    const errors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        errors[String(issue.path[0] ?? 'body')] ??= issue.message;
    }
    Object.assign(
      errors,
      checkAccountChange({
        next: ruleView(next),
        previous: previous ? ruleView(previous) : null,
        others: ctx.accounts
          .list()
          .filter((a) => a.id !== next.id)
          .map(ruleView),
        hasTransactions: previous ? ctx.ledger.existsForAccount(next.id) : false,
      }),
    );
    if (Object.keys(errors).length > 0) return { ok: false as const, errors };

    const record: LocalAccountRecord = {
      ...next,
      name: next.name.trim(),
      syncState: 'pending',
      syncError: null,
    };
    // Igual que el servidor: marcar una cuenta por defecto desmarca las demás (research §9).
    if (record.isDefault) ctx.accounts.clearDefaultExcept(record.id, record.updatedAt);
    ctx.accounts.save(record);
    ctx.outbox.enqueue(
      {
        entity: 'account',
        entityId: record.id,
        operation: 'upsert',
        payload: { method: 'PUT', path: `/v1/accounts/${record.id}`, body: toPayload(record) },
      },
      { compact: true },
    );
    refreshLedger(ctx);
    flushIfOnline(ctx);
    return { ok: true as const, account: record };
  }

  function parseBalance(form: AccountForm, errors: Record<string, string>): string {
    const parsed = parseAmount(form.initialBalanceText.trim() || '0', form.currency, {
      allowNegative: true,
      allowZero: true,
    });
    if (parsed.ok) return parsed.value;
    errors.initialBalance = parsed.error;
    return '0';
  }

  function current(ctx: LedgerContext, id: string): LocalAccountRecord {
    const account = ctx.accounts.findById(id);
    if (!account) throw new Error(`La cuenta ${id} no existe en el teléfono`);
    return account;
  }

  return {
    /** Crea una cuenta de dinero (3.1). */
    create(form: AccountForm, { isDefault = false } = {}): AccountResult {
      const ctx = requireContext();
      const errors: Record<string, string> = {};
      const initialBalance = parseBalance(form, errors);
      if (Object.keys(errors).length > 0) return { ok: false, errors };
      const at = nextUpdatedAt(null);
      return save(
        ctx,
        {
          id: newId(),
          name: form.name,
          type: form.type,
          currency: form.currency,
          initialBalance,
          isDefault,
          archivedAt: null,
          createdAt: at,
          updatedAt: at,
          deletedAt: null,
          syncState: 'pending',
          syncError: null,
        },
        null,
      );
    },

    /** Renombra o cambia tipo, saldo inicial o moneda (esta solo sin movimientos, FR-019). */
    update(id: string, form: AccountForm): AccountResult {
      const ctx = requireContext();
      const previous = current(ctx, id);
      const errors: Record<string, string> = {};
      const initialBalance = parseBalance(form, errors);
      if (Object.keys(errors).length > 0) return { ok: false, errors };
      return save(
        ctx,
        {
          ...previous,
          name: form.name,
          type: form.type,
          currency: form.currency,
          initialBalance,
          updatedAt: nextUpdatedAt(previous),
        },
        previous,
      );
    },

    /** La vuelve la cuenta por defecto; la anterior deja de serlo (3.3). */
    setDefault(id: string): AccountResult {
      const ctx = requireContext();
      const previous = current(ctx, id);
      return save(
        ctx,
        { ...previous, isDefault: true, updatedAt: nextUpdatedAt(previous) },
        previous,
      );
    },

    /** Archiva la cuenta; la cuenta por defecto no se puede archivar (3.6, 3.7). */
    archive(id: string): AccountResult {
      const ctx = requireContext();
      const previous = current(ctx, id);
      const at = nextUpdatedAt(previous);
      return save(ctx, { ...previous, archivedAt: at, updatedAt: at }, previous);
    },

    /** Reactiva la cuenta, con otro nombre si el suyo ya lo usa otra activa (FR-021). */
    unarchive(id: string, name?: string): AccountResult {
      const ctx = requireContext();
      const previous = current(ctx, id);
      return save(
        ctx,
        {
          ...previous,
          name: name ?? previous.name,
          archivedAt: null,
          updatedAt: nextUpdatedAt(previous),
        },
        previous,
      );
    },

    /** El servidor aceptó el cambio; queda `synced` solo si lo enviado es la versión actual. */
    markSent(id: string, sentUpdatedAt: string | undefined): void {
      const ctx = context();
      const local = ctx?.accounts.findById(id);
      if (!ctx || !local || local.updatedAt !== sentUpdatedAt) return;
      ctx.accounts.markSync(id, 'synced');
      refreshLedger(ctx);
    },

    /** El servidor lo rechazó: la cuenta se queda en el teléfono, marcada (FR-037). */
    markRejected(id: string, body: unknown): void {
      const ctx = context();
      if (!ctx) return;
      ctx.accounts.markSync(id, 'rejected', rejectionMessage(body));
      refreshLedger(ctx);
    },

    /** 409: el servidor tiene una versión igual o más nueva: el teléfono la adopta. */
    adoptServerVersion(id: string, body: unknown): void {
      const ctx = context();
      const server = body as (AccountPayload & { createdAt?: string }) | null;
      if (!ctx || typeof server?.updatedAt !== 'string') return;
      const local = ctx.accounts.findById(id);
      if (local && Date.parse(server.updatedAt) < Date.parse(local.updatedAt)) return;
      if (server.isDefault) ctx.accounts.clearDefaultExcept(id, server.updatedAt);
      ctx.accounts.save({
        id,
        name: server.name,
        type: server.type,
        currency: server.currency,
        initialBalance: server.initialBalance,
        isDefault: server.isDefault,
        archivedAt: server.archivedAt,
        createdAt: server.createdAt ?? local?.createdAt ?? server.updatedAt,
        updatedAt: server.updatedAt,
        deletedAt: null,
        syncState: 'synced',
        syncError: null,
      });
      refreshLedger(ctx);
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;

export const accountService = createAccountService({
  context: openLedgerContext,
  now: () => Date.now(),
  // React Native no tiene `globalThis.crypto`: el UUID sale de expo-crypto.
  newId: () => Crypto.randomUUID(),
});

/** Qué hace el outbox con la respuesta del servidor a un cambio de una cuenta. */
export function accountOutboxHandlers(service: AccountService = accountService) {
  return {
    onSent: (item: OutboxItem) =>
      service.markSent(
        item.entityId,
        (item.payload as { body?: { updatedAt?: string } }).body?.updatedAt,
      ),
    onRejected: (item: OutboxItem, body: unknown) => service.markRejected(item.entityId, body),
    onConflict: (item: OutboxItem, body: unknown) =>
      service.adoptServerVersion(item.entityId, body),
  };
}

/** Se registra al arrancar la app (en `_layout`), igual que el de los movimientos. */
export function registerAccountHandlers(service: AccountService = accountService): void {
  const handlers = accountOutboxHandlers(service);
  onOutboxSent('account', handlers.onSent);
  onOutboxRejected('account', (body, item) => handlers.onRejected(item, body));
  onOutboxConflict('account', (body, item) => handlers.onConflict(item, body));
}
