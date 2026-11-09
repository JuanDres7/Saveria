import { API_URL, api } from '../api/instance';
import { getOpenUserDb, type UserDb } from '../db/open-user-db';
import { useSession } from '../session/session-store';
import { createHttpSender } from './http-sender';
import { createOutbox, DrizzleOutboxStore, type Outbox, type OutboxItem } from './outbox';

type ConflictHandler = (serverBody: unknown, item: OutboxItem) => void | Promise<void>;
type SentHandler = (item: OutboxItem) => void | Promise<void>;

/** Qué hacer con un 409 según la entidad del cambio (por ejemplo, el perfil adopta el del servidor). */
const conflictHandlers = new Map<string, ConflictHandler>();
/** Qué hacer cuando el servidor rechaza un cambio sin arreglo (FR-037: marcarlo). */
const rejectedHandlers = new Map<string, ConflictHandler>();
/** Qué hacer cuando el servidor acepta un cambio (por ejemplo, marcarlo `synced`). */
const sentHandlers = new Map<string, SentHandler>();

export function onOutboxConflict(entity: string, handler: ConflictHandler): void {
  conflictHandlers.set(entity, handler);
}

export function onOutboxRejected(entity: string, handler: ConflictHandler): void {
  rejectedHandlers.set(entity, handler);
}

export function onOutboxSent(entity: string, handler: SentHandler): void {
  sentHandlers.set(entity, handler);
}

let current: { db: UserDb; outbox: Outbox } | null = null;

/**
 * Un solo outbox por base abierta: así su `flush` (que no deja correr dos envíos a la vez) protege
 * a todos los que lo usan y un cambio no se manda dos veces.
 */
export function outboxFor(db: UserDb): Outbox {
  if (current?.db !== db) {
    const sender = createHttpSender(api.fetch, API_URL, {
      onConflict: (item, body) => conflictHandlers.get(item.entity)?.(body, item),
      onRejected: (item, body) => rejectedHandlers.get(item.entity)?.(body, item),
      onSent: (item) => sentHandlers.get(item.entity)?.(item),
    });
    current = { db, outbox: createOutbox(new DrizzleOutboxStore(db), sender) };
  }
  return current.outbox;
}

function openOutbox(): Pick<Outbox, 'flush'> | null {
  const open = getOpenUserDb();
  return open ? outboxFor(open.db) : null;
}

/** Envía lo pendiente cada vez que vuelve la conexión con la sesión iniciada (FR-022). */
export function watchOutbox(getOutbox: () => Pick<Outbox, 'flush'> | null = openOutbox) {
  return useSession.subscribe((state, previous) => {
    if (!state.isOnline || previous.isOnline || state.status !== 'signedIn') return;
    void getOutbox()
      ?.flush()
      .catch(() => undefined);
  });
}
