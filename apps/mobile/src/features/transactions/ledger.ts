import { create } from 'zustand';
import { getOpenUserDb } from '../../db/open-user-db';
import type { Outbox } from '../../outbox/outbox';
import { outboxFor } from '../../outbox/user-outbox';
import { useSession } from '../../session/session-store';
import { type LocalAccountRecord, LocalAccounts } from '../accounts/local-accounts';
import { type LocalTransactionRecord, LocalTransactions } from './local-transactions';

export type AccountsStore = Pick<
  LocalAccounts,
  'list' | 'findById' | 'save' | 'clearDefaultExcept' | 'markSync'
>;
export type LedgerStore = Pick<
  LocalTransactions,
  | 'save'
  | 'findById'
  | 'softDelete'
  | 'restore'
  | 'markSync'
  | 'existsForAccount'
  | 'balances'
  | 'history'
>;

/** Lo que necesitan cuentas y movimientos: la base local del usuario y su outbox. */
export interface LedgerContext {
  accounts: AccountsStore;
  ledger: LedgerStore;
  outbox: Pick<Outbox, 'enqueue' | 'flush'>;
}

function openRealContext(): LedgerContext | null {
  const open = getOpenUserDb();
  if (!open) return null;
  return {
    accounts: new LocalAccounts(open.db),
    ledger: new LocalTransactions(open.db),
    outbox: outboxFor(open.db),
  };
}

let contextFactory: () => LedgerContext | null = openRealContext;

/** La base del usuario que está abierta, o `null` si no hay sesión. */
export function openLedgerContext(): LedgerContext | null {
  return contextFactory();
}

/** Solo para pruebas: usa otra base (en memoria). Sin argumento vuelve a la real. */
export function setLedgerContextForTests(factory?: () => LedgerContext | null): void {
  contextFactory = factory ?? openRealContext;
}

/** Cuántos movimientos recientes muestra Inicio. */
export const RECENT_COUNT = 5;

interface LedgerSnapshot {
  accounts: LocalAccountRecord[];
  /** Saldo por id de cuenta, en texto decimal */
  balances: Record<string, string>;
  recent: LocalTransactionRecord[];
}

/** Lo que muestran las pantallas. Se recalcula desde la base local después de cada cambio. */
export const useLedger = create<LedgerSnapshot>(() => ({ accounts: [], balances: {}, recent: [] }));

export function refreshLedger(ctx: LedgerContext | null = openLedgerContext()): void {
  if (!ctx) return;
  useLedger.setState({
    accounts: ctx.accounts.list(),
    balances: Object.fromEntries(ctx.ledger.balances()),
    recent: ctx.ledger.history({ limit: RECENT_COUNT }),
  });
}

/** Envía lo pendiente si hay red; sin red queda en el outbox hasta que vuelva. */
export function flushIfOnline(ctx: LedgerContext): void {
  if (!useSession.getState().isOnline) return;
  void ctx.outbox
    .flush()
    .then(() => refreshLedger(ctx))
    .catch(() => undefined);
}

/** Mensaje para el usuario a partir de la respuesta de error del servidor (FR-037). */
export function rejectionMessage(body: unknown): string {
  const error = body as { message?: unknown; fields?: Record<string, unknown> } | null;
  const field = error?.fields
    ? Object.values(error.fields).find((v) => typeof v === 'string')
    : null;
  if (typeof field === 'string') return field;
  if (typeof error?.message === 'string') return error.message;
  return 'El servidor no lo aceptó';
}
