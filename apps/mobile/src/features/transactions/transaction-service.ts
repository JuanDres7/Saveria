import { localToday, parseAmount, transactionInputSchema } from '@saveria/shared';
import * as Crypto from 'expo-crypto';
import type { OutboxItem } from '../../outbox/outbox';
import { onOutboxConflict, onOutboxRejected, onOutboxSent } from '../../outbox/user-outbox';
import {
  flushIfOnline,
  type LedgerContext,
  openLedgerContext,
  refreshLedger,
  rejectionMessage,
} from './ledger';
import type { LocalTransactionRecord } from './local-transactions';

/** Lo que llena el formulario de gasto o ingreso. El monto llega tal como lo escribió el usuario. */
export interface RecordForm {
  type: 'expense' | 'income';
  amountText: string;
  accountId: string | null;
  categorySlug: string | null;
  occurredOn: string;
  description: string;
}

/** Marca del motivo cuando el servidor rechazó un borrado (FR-037): la fila muestra "no se pudo borrar". */
export const DELETE_REJECTED_PREFIX = 'No se pudo borrar: ';

export type SaveResult =
  | { ok: true; transaction: LocalTransactionRecord }
  | { ok: false; errors: Record<string, string> };

export interface TransactionServiceDeps {
  context(): LedgerContext | null;
  now(): number;
  newId(): string;
  today(): string;
}

/** El registro completo que se envía en `PUT /v1/transactions/{id}` (contrato TransactionInput). */
export type TransactionPayload = Omit<
  LocalTransactionRecord,
  'id' | 'createdAt' | 'syncState' | 'syncError'
>;

function toInput(record: LocalTransactionRecord): TransactionPayload {
  const { id: _id, createdAt: _c, syncState: _s, syncError: _e, ...input } = record;
  return input;
}

export function createTransactionService({ context, now, newId, today }: TransactionServiceDeps) {
  function requireContext(): LedgerContext {
    const ctx = context();
    if (!ctx) throw new Error('No hay una sesión con la base local abierta');
    return ctx;
  }

  /** Guarda en el teléfono, encola el registro completo y lo envía si hay red (FR-034, FR-035). */
  function persist(ctx: LedgerContext, record: LocalTransactionRecord): void {
    ctx.ledger.save(record);
    ctx.outbox.enqueue(
      {
        entity: 'transaction',
        entityId: record.id,
        operation: 'upsert',
        payload: { method: 'PUT', path: `/v1/transactions/${record.id}`, body: toInput(record) },
      },
      { compact: true },
    );
    refreshLedger(ctx);
    flushIfOnline(ctx);
  }

  /** Siempre más nuevo que lo guardado, aunque el reloj del teléfono vaya atrasado. */
  function nextUpdatedAt(previous: LocalTransactionRecord): string {
    return new Date(Math.max(now(), Date.parse(previous.updatedAt) + 1)).toISOString();
  }

  /** Arma y valida el movimiento del formulario con las mismas reglas que el servidor. */
  function build(
    ctx: LedgerContext,
    form: RecordForm,
    base: { id: string; createdAt: string; updatedAt: string },
  ): SaveResult {
    const errors: Record<string, string> = {};
    const account = form.accountId ? ctx.accounts.findById(form.accountId) : null;
    if (!account || account.deletedAt !== null) errors.accountId = 'Elige una cuenta';

    let amount = '';
    if (account) {
      const parsed = parseAmount(form.amountText, account.currency);
      if (parsed.ok) amount = parsed.value;
      else errors.amount = parsed.error;
    }
    if (form.categorySlug === null) errors.categorySlug = 'Elige una categoría';
    if (!account || Object.keys(errors).length > 0) return { ok: false, errors };

    const record: LocalTransactionRecord = {
      ...base,
      type: form.type,
      accountId: account.id,
      amount,
      currency: account.currency,
      toAccountId: null,
      toAmount: null,
      toCurrency: null,
      categorySlug: form.categorySlug,
      description: form.description.trim() === '' ? null : form.description.trim(),
      occurredOn: form.occurredOn || today(),
      deletedAt: null,
      syncState: 'pending',
      syncError: null,
    };

    const parsed = transactionInputSchema.safeParse(toInput(record));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors[String(issue.path[0] ?? 'body')] ??= issue.message;
      }
      return { ok: false, errors };
    }
    return { ok: true, transaction: record };
  }

  return {
    /** Registra un gasto o un ingreso (historia 1). Valida con las mismas reglas que el servidor. */
    record(form: RecordForm): SaveResult {
      const ctx = requireContext();
      const at = new Date(now()).toISOString();
      const built = build(ctx, form, { id: newId(), createdAt: at, updatedAt: at });
      if (!built.ok) return built;
      persist(ctx, built.transaction);
      return built;
    },

    /**
     * Edita un movimiento (historia 4): mismas reglas que al crearlo. Al pasarlo a una cuenta de
     * otra moneda el monto se vuelve a escribir en la nueva moneda, nunca se convierte (FR-025).
     */
    update(id: string, form: RecordForm): SaveResult {
      const ctx = requireContext();
      const previous = ctx.ledger.findById(id);
      if (!previous || previous.deletedAt !== null) {
        return { ok: false, errors: { body: 'El movimiento ya no existe' } };
      }
      const built = build(ctx, form, {
        id,
        createdAt: previous.createdAt,
        updatedAt: nextUpdatedAt(previous),
      });
      if (!built.ok) return built;
      persist(ctx, built.transaction);
      return built;
    },

    /** Borrado lógico al instante (FR-026): sale de los saldos y del historial y encola el `DELETE`. */
    remove(id: string): void {
      const ctx = requireContext();
      const previous = ctx.ledger.findById(id);
      if (!previous) return;
      const at = nextUpdatedAt(previous);
      ctx.ledger.softDelete(id, at);
      ctx.outbox.enqueue(
        {
          entity: 'transaction',
          entityId: id,
          operation: 'delete',
          payload: {
            method: 'DELETE',
            path: `/v1/transactions/${id}`,
            body: { updatedAt: at },
          },
        },
        { compact: true },
      );
      refreshLedger(ctx);
      flushIfOnline(ctx);
    },

    /** "Deshacer": el movimiento vuelve tal como estaba, con un `PUT` más nuevo que el borrado. */
    restore(id: string): void {
      const ctx = requireContext();
      const previous = ctx.ledger.findById(id);
      if (!previous) return;
      persist(ctx, {
        ...previous,
        deletedAt: null,
        updatedAt: nextUpdatedAt(previous),
        syncState: 'pending',
        syncError: null,
      });
    },

    /**
     * El servidor aceptó el cambio (2xx). Solo queda `synced` si lo enviado es la versión actual:
     * si mientras tanto hubo otro cambio, ese sigue pendiente en la cola.
     */
    markSent(id: string, sentUpdatedAt: string | undefined): void {
      const ctx = context();
      const local = ctx?.ledger.findById(id);
      if (!ctx || !local || local.updatedAt !== sentUpdatedAt) return;
      ctx.ledger.markSync(id, 'synced');
      refreshLedger(ctx);
    },

    /**
     * El servidor lo rechazó sin arreglo: se queda en el teléfono, marcado (FR-037). Si lo
     * rechazado era un borrado, el movimiento vuelve a verse como "no se pudo borrar" y se puede
     * reintentar.
     */
    markRejected(id: string, body: unknown, operation = 'upsert'): void {
      const ctx = context();
      if (!ctx) return;
      if (operation === 'delete') {
        const local = ctx.ledger.findById(id);
        if (local) ctx.ledger.restore(id, local.updatedAt);
        ctx.ledger.markSync(id, 'rejected', `${DELETE_REJECTED_PREFIX}${rejectionMessage(body)}`);
      } else {
        ctx.ledger.markSync(id, 'rejected', rejectionMessage(body));
      }
      refreshLedger(ctx);
    },

    /** 409: el servidor tiene una versión igual o más nueva: el teléfono la adopta. */
    adoptServerVersion(id: string, body: unknown): void {
      const ctx = context();
      const server = body as (TransactionPayload & { createdAt?: string }) | null;
      if (!ctx || typeof server?.updatedAt !== 'string') return;
      const local = ctx.ledger.findById(id);
      // Si lo local es más nuevo, hay un cambio posterior todavía en la cola: se respeta.
      if (local && Date.parse(server.updatedAt) < Date.parse(local.updatedAt)) return;
      ctx.ledger.save({
        id,
        type: server.type,
        accountId: server.accountId,
        amount: server.amount,
        currency: server.currency,
        toAccountId: server.toAccountId,
        toAmount: server.toAmount,
        toCurrency: server.toCurrency,
        categorySlug: server.categorySlug,
        description: server.description,
        occurredOn: server.occurredOn,
        createdAt: server.createdAt ?? local?.createdAt ?? server.updatedAt,
        updatedAt: server.updatedAt,
        deletedAt: server.deletedAt,
        syncState: 'synced',
        syncError: null,
      });
      refreshLedger(ctx);
    },
  };
}

export type TransactionService = ReturnType<typeof createTransactionService>;

export const transactionService = createTransactionService({
  context: openLedgerContext,
  now: () => Date.now(),
  // React Native no tiene `globalThis.crypto`: el UUID sale de expo-crypto.
  newId: () => Crypto.randomUUID(),
  today: () => localToday(),
});

/** Qué hace el outbox con la respuesta del servidor a un cambio de un movimiento. */
export function transactionOutboxHandlers(service: TransactionService = transactionService) {
  return {
    onSent: (item: OutboxItem) =>
      service.markSent(
        item.entityId,
        (item.payload as { body?: { updatedAt?: string } }).body?.updatedAt,
      ),
    onRejected: (item: OutboxItem, body: unknown) =>
      service.markRejected(item.entityId, body, item.operation),
    onConflict: (item: OutboxItem, body: unknown) =>
      service.adoptServerVersion(item.entityId, body),
  };
}

/** Se registra al arrancar la app (en `_layout`), igual que el manejador del perfil. */
export function registerTransactionHandlers(
  service: TransactionService = transactionService,
): void {
  const handlers = transactionOutboxHandlers(service);
  onOutboxSent('transaction', handlers.onSent);
  onOutboxRejected('transaction', (body, item) => handlers.onRejected(item, body));
  onOutboxConflict('transaction', (body, item) => handlers.onConflict(item, body));
}
