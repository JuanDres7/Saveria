import { and, asc, eq, ne, count as sqlCount } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import type { UserDb } from '../db/open-user-db';
import { outbox } from '../db/schema';

export interface OutboxItem {
  id: string;
  entity: string;
  entityId: string;
  operation: string;
  payload: unknown;
  /** Milisegundos desde 1970 */
  createdAt: number;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: number;
}

export type NewOutboxItem = Pick<OutboxItem, 'entity' | 'entityId' | 'operation' | 'payload'>;

/** Resultado de intentar enviar un cambio al servidor. */
export type SendResult =
  /** El servidor lo aceptó: se quita de la cola. */
  | { status: 'sent' }
  /** No tiene arreglo (por ejemplo, el servidor ya tiene una versión más nueva): se descarta. */
  | { status: 'discard'; reason?: string }
  /** Falla pasajera (sin red, 5xx, 429…): se reintenta más tarde con espera creciente. */
  | { status: 'retry'; error: string };

export type Sender = (item: OutboxItem) => Promise<SendResult>;

/** Almacenamiento de la cola. La implementación real usa la base local cifrada. */
export interface OutboxStore {
  insert(item: OutboxItem): void;
  /** El cambio más antiguo, tenga o no que esperar. */
  oldest(): OutboxItem | null;
  remove(id: string): void;
  markFailed(id: string, error: string, nextAttemptAt: number): void;
  count(): number;
  /**
   * Compactar: si la entidad ya tiene cambios pendientes (salvo `exceptId`, el que se está
   * enviando), el más antiguo pasa a llevar este cambio y conserva su lugar en la cola; los demás
   * se borran. Devuelve su id, o `null` si no había nada pendiente.
   */
  replacePending(change: NewOutboxItem, exceptId: string | null): string | null;
}

export class DrizzleOutboxStore implements OutboxStore {
  constructor(private readonly db: UserDb) {}

  insert(item: OutboxItem): void {
    this.db.insert(outbox).values(item).run();
  }

  oldest(): OutboxItem | null {
    const row = this.db
      .select()
      .from(outbox)
      .orderBy(asc(outbox.createdAt), asc(outbox.id))
      .limit(1)
      .get();
    return row ?? null;
  }

  remove(id: string): void {
    this.db.delete(outbox).where(eq(outbox.id, id)).run();
  }

  markFailed(id: string, error: string, nextAttemptAt: number): void {
    const row = this.db.select().from(outbox).where(eq(outbox.id, id)).get();
    if (!row) return;
    this.db
      .update(outbox)
      .set({ attempts: row.attempts + 1, lastError: error, nextAttemptAt })
      .where(eq(outbox.id, id))
      .run();
  }

  count(): number {
    return this.db.select({ n: sqlCount() }).from(outbox).get()?.n ?? 0;
  }

  replacePending(change: NewOutboxItem, exceptId: string | null): string | null {
    const pending = this.db
      .select({ id: outbox.id })
      .from(outbox)
      .where(
        and(
          eq(outbox.entity, change.entity),
          eq(outbox.entityId, change.entityId),
          exceptId === null ? undefined : ne(outbox.id, exceptId),
        ),
      )
      .orderBy(asc(outbox.createdAt), asc(outbox.id))
      .all();
    const [first, ...rest] = pending;
    if (!first) return null;
    this.db
      .update(outbox)
      .set({
        operation: change.operation,
        payload: change.payload,
        attempts: 0,
        lastError: null,
        nextAttemptAt: 0,
      })
      .where(eq(outbox.id, first.id))
      .run();
    for (const { id } of rest) this.db.delete(outbox).where(eq(outbox.id, id)).run();
    return first.id;
  }
}

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60 * 1_000;

/** 1 s, 2 s, 4 s, … hasta 5 minutos. */
export function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS);
}

export interface FlushSummary {
  sent: number;
  discarded: number;
  remaining: number;
  /** Por qué se detuvo antes de vaciar la cola, si pasó */
  stoppedBy: 'retry' | 'waiting' | null;
}

export interface OutboxOptions {
  now?: () => number;
  newId?: () => string;
}

export function createOutbox(store: OutboxStore, send: Sender, options: OutboxOptions = {}) {
  const now = options.now ?? (() => Date.now());
  // React Native no tiene `globalThis.crypto`: el UUID sale de expo-crypto.
  const newId = options.newId ?? (() => Crypto.randomUUID());
  let running: Promise<FlushSummary> | null = null;
  // `createdAt` define el orden de envío: dos cambios en el mismo milisegundo no pueden empatar.
  let lastCreatedAt = 0;
  // El cambio que se está enviando: compactar nunca lo toca.
  let inFlightId: string | null = null;

  async function run(): Promise<FlushSummary> {
    const summary: FlushSummary = { sent: 0, discarded: 0, remaining: 0, stoppedBy: null };

    // Siempre se envía el más antiguo primero y la cola se detiene ante un fallo pasajero:
    // los cambios de una misma entidad deben llegar en el orden en que se hicieron.
    for (;;) {
      const item = store.oldest();
      if (!item) break;
      if (item.nextAttemptAt > now()) {
        summary.stoppedBy = 'waiting';
        break;
      }

      let result: SendResult;
      inFlightId = item.id;
      try {
        result = await send(item);
      } catch (error) {
        result = { status: 'retry', error: error instanceof Error ? error.message : 'error' };
      } finally {
        inFlightId = null;
      }

      if (result.status === 'retry') {
        store.markFailed(item.id, result.error, now() + backoffMs(item.attempts + 1));
        summary.stoppedBy = 'retry';
        break;
      }
      store.remove(item.id);
      if (result.status === 'sent') summary.sent += 1;
      else summary.discarded += 1;
    }

    summary.remaining = store.count();
    return summary;
  }

  return {
    /**
     * Guarda un cambio para enviarlo cuando haya conexión y sesión. Con `compact` (cambios que
     * llevan el registro completo, como cuentas y movimientos) reemplaza al cambio pendiente de la
     * misma entidad en su mismo lugar de la cola: llega solo el estado final (research §3).
     */
    enqueue(item: NewOutboxItem, { compact = false }: { compact?: boolean } = {}): string {
      if (compact) {
        const replaced = store.replacePending(item, inFlightId);
        if (replaced) return replaced;
      }
      const id = newId();
      lastCreatedAt = Math.max(now(), lastCreatedAt + 1);
      store.insert({
        id,
        ...item,
        createdAt: lastCreatedAt,
        attempts: 0,
        lastError: null,
        nextAttemptAt: 0,
      });
      return id;
    },
    /** Cuántos cambios esperan; el aviso de cerrar sesión (FR-010a) usa este número. */
    count(): number {
      return store.count();
    },
    /** Envía lo pendiente. Si ya hay un envío en curso, espera ese mismo en vez de empezar otro. */
    flush(): Promise<FlushSummary> {
      running ??= run().finally(() => {
        running = null;
      });
      return running;
    },
  };
}

export type Outbox = ReturnType<typeof createOutbox>;
