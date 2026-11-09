import {
  backoffMs,
  createOutbox,
  type NewOutboxItem,
  type OutboxItem,
  type OutboxStore,
  type Sender,
  type SendResult,
} from '../src/outbox/outbox';

/** Cola en memoria con las mismas reglas que la implementación sobre SQLite. */
class MemoryStore implements OutboxStore {
  items: OutboxItem[] = [];
  insert(item: OutboxItem) {
    this.items.push({ ...item });
  }
  oldest() {
    const sorted = [...this.items].sort(
      (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
    );
    return sorted[0] ? { ...sorted[0] } : null;
  }
  remove(id: string) {
    this.items = this.items.filter((i) => i.id !== id);
  }
  markFailed(id: string, error: string, nextAttemptAt: number) {
    const item = this.items.find((i) => i.id === id);
    if (item) Object.assign(item, { attempts: item.attempts + 1, lastError: error, nextAttemptAt });
  }
  count() {
    return this.items.length;
  }
  replacePending(change: NewOutboxItem, exceptId: string | null) {
    const pending = this.items
      .filter(
        (i) => i.entity === change.entity && i.entityId === change.entityId && i.id !== exceptId,
      )
      .sort((a, b) => a.createdAt - b.createdAt);
    const [first, ...rest] = pending;
    if (!first) return null;
    Object.assign(first, {
      operation: change.operation,
      payload: change.payload,
      attempts: 0,
      lastError: null,
      nextAttemptAt: 0,
    });
    this.items = this.items.filter((i) => !rest.includes(i));
    return first.id;
  }
}

function setup(send: Sender = async () => ({ status: 'sent' })) {
  let clock = 1_000_000;
  let counter = 0;
  const store = new MemoryStore();
  const outbox = createOutbox(store, send, {
    now: () => clock,
    newId: () => `id-${String(++counter).padStart(3, '0')}`,
  });
  return {
    store,
    outbox,
    tick: (ms: number) => {
      clock += ms;
    },
  };
}

const change = (entityId: string, value: unknown = {}) => ({
  entity: 'profile',
  entityId,
  operation: 'upsert',
  payload: value,
});

describe('outbox', () => {
  it('enqueue guarda el cambio y count lo cuenta', () => {
    const { outbox, store } = setup();
    outbox.enqueue(change('u1', { city: 'Barranquilla' }));
    expect(outbox.count()).toBe(1);
    expect(store.items[0]).toMatchObject({
      entity: 'profile',
      entityId: 'u1',
      operation: 'upsert',
      payload: { city: 'Barranquilla' },
      attempts: 0,
      lastError: null,
      nextAttemptAt: 0,
    });
  });

  it('sin generador de ids propio no depende de globalThis.crypto (no existe en React Native)', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      const store = new MemoryStore();
      const outbox = createOutbox(store, async () => ({ status: 'sent' }));
      const id = outbox.enqueue(change('u1'));
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(store.items[0]?.id).toBe(id);
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
    }
  });

  it('flush envía los cambios en el orden en que se hicieron y vacía la cola', async () => {
    const order: string[] = [];
    const { outbox, tick } = setup(async (item) => {
      order.push(item.entityId);
      return { status: 'sent' };
    });
    outbox.enqueue(change('primero'));
    tick(10);
    outbox.enqueue(change('segundo'));
    tick(10);
    outbox.enqueue(change('tercero'));

    const summary = await outbox.flush();

    expect(order).toEqual(['primero', 'segundo', 'tercero']);
    expect(summary).toEqual({ sent: 3, discarded: 0, remaining: 0, stoppedBy: null });
    expect(outbox.count()).toBe(0);
  });

  it('dos cambios en el mismo milisegundo salen en el orden en que se encolaron', async () => {
    const order: string[] = [];
    const store = new MemoryStore();
    // ids que, ordenados, quedarían al revés: el orden no puede depender de ellos
    const ids = ['z-id', 'a-id'];
    const outbox = createOutbox(
      store,
      async (item) => {
        order.push(item.entityId);
        return { status: 'sent' };
      },
      { now: () => 5_000, newId: () => ids.shift() ?? 'x' },
    );
    outbox.enqueue(change('perfil'));
    outbox.enqueue(change('terminar-onboarding'));
    await outbox.flush();
    expect(order).toEqual(['perfil', 'terminar-onboarding']);
  });

  it('con la cola vacía no hace nada', async () => {
    const send = jest.fn<ReturnType<Sender>, Parameters<Sender>>();
    const { outbox } = setup(send);
    expect(await outbox.flush()).toEqual({ sent: 0, discarded: 0, remaining: 0, stoppedBy: null });
    expect(send).not.toHaveBeenCalled();
  });

  it('ante un fallo pasajero se detiene, conserva el orden y registra el error', async () => {
    const seen: string[] = [];
    const { outbox, store, tick } = setup(async (item) => {
      seen.push(item.entityId);
      return item.entityId === 'a' ? { status: 'retry', error: 'sin red' } : { status: 'sent' };
    });
    outbox.enqueue(change('a'));
    tick(5);
    outbox.enqueue(change('b'));

    const summary = await outbox.flush();

    expect(seen).toEqual(['a']); // 'b' no se envía antes que 'a'
    expect(summary).toEqual({ sent: 0, discarded: 0, remaining: 2, stoppedBy: 'retry' });
    expect(store.items.find((i) => i.entityId === 'a')).toMatchObject({
      attempts: 1,
      lastError: 'sin red',
    });
  });

  it('respeta la espera (backoff) antes de reintentar', async () => {
    let fail = true;
    const send = jest.fn<Promise<SendResult>, [OutboxItem]>(async () =>
      fail ? { status: 'retry', error: 'caído' } : { status: 'sent' },
    );
    const { outbox, tick } = setup(send);
    outbox.enqueue(change('a'));

    await outbox.flush(); // 1.er intento: falla, queda esperando 1 s
    expect(send).toHaveBeenCalledTimes(1);

    tick(500);
    expect((await outbox.flush()).stoppedBy).toBe('waiting');
    expect(send).toHaveBeenCalledTimes(1);

    tick(600); // ya pasó 1 s
    fail = false;
    expect((await outbox.flush()).sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('la espera crece con cada fallo hasta un máximo de 5 minutos', () => {
    expect([1, 2, 3, 4, 5].map(backoffMs)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000]);
    expect(backoffMs(20)).toBe(5 * 60 * 1000);
    expect(backoffMs(0)).toBe(1_000);
  });

  it('un cambio descartado sale de la cola y la cola sigue con el siguiente', async () => {
    const { outbox, tick } = setup(async (item) =>
      item.entityId === 'viejo'
        ? { status: 'discard', reason: 'el servidor tiene algo más nuevo' }
        : { status: 'sent' },
    );
    outbox.enqueue(change('viejo'));
    tick(1);
    outbox.enqueue(change('nuevo'));
    expect(await outbox.flush()).toEqual({ sent: 1, discarded: 1, remaining: 0, stoppedBy: null });
  });

  it('si el envío lanza una excepción lo trata como fallo pasajero', async () => {
    const { outbox, store } = setup(async () => {
      throw new Error('Network request failed');
    });
    outbox.enqueue(change('a'));
    const summary = await outbox.flush();
    expect(summary.stoppedBy).toBe('retry');
    expect(store.items[0]?.lastError).toBe('Network request failed');
  });

  it('dos flush simultáneos comparten el mismo envío (no se manda dos veces)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const send = jest.fn(async () => {
      await gate;
      return { status: 'sent' } as const;
    });
    const { outbox } = setup(send);
    outbox.enqueue(change('a'));

    const first = outbox.flush();
    const second = outbox.flush();
    release();
    await Promise.all([first, second]);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('count refleja lo pendiente para el aviso de cerrar sesión (FR-010a)', async () => {
    const { outbox } = setup(async () => ({ status: 'retry', error: 'sin red' }));
    outbox.enqueue(change('a'));
    outbox.enqueue(change('b'));
    await outbox.flush();
    expect(outbox.count()).toBe(2);
  });
});

describe('outbox: compactar por entidad (research §3)', () => {
  const tx = (entityId: string, operation: string, payload: unknown) => ({
    entity: 'transaction',
    entityId,
    operation,
    payload,
  });

  it('un cambio nuevo de la misma entidad reemplaza al pendiente y conserva su lugar', async () => {
    const sent: unknown[] = [];
    const { store, outbox } = setup(async (item) => {
      sent.push(item.payload);
      return { status: 'sent' };
    });
    outbox.enqueue({ ...change('cuenta'), entity: 'account', payload: 'cuenta v1' });
    outbox.enqueue(tx('t1', 'upsert', 'gasto v1'), { compact: true });
    outbox.enqueue(
      { ...change('cuenta'), entity: 'account', payload: 'cuenta v2' },
      { compact: true },
    );
    outbox.enqueue(tx('t1', 'upsert', 'gasto v2'), { compact: true });
    expect(store.items).toHaveLength(2);

    await outbox.flush();
    // La cuenta sigue saliendo antes que su movimiento, ya con su versión final.
    expect(sent).toEqual(['cuenta v2', 'gasto v2']);
  });

  it('crear, editar y borrar sin red deja un solo cambio con el estado final (caso límite)', async () => {
    const { store, outbox } = setup(async () => ({ status: 'retry', error: 'sin red' }));
    outbox.enqueue(tx('t1', 'upsert', 'creado'), { compact: true });
    outbox.enqueue(tx('t1', 'upsert', 'editado'), { compact: true });
    outbox.enqueue(tx('t1', 'delete', 'borrado'), { compact: true });
    expect(store.items).toHaveLength(1);
    expect(store.items[0]).toMatchObject({ operation: 'delete', payload: 'borrado' });
  });

  it('el reemplazo reinicia los reintentos del cambio', async () => {
    const { store, outbox } = setup(async () => ({ status: 'retry', error: 'sin red' }));
    outbox.enqueue(tx('t1', 'upsert', 'v1'), { compact: true });
    await outbox.flush();
    expect(store.items[0]?.attempts).toBe(1);
    outbox.enqueue(tx('t1', 'upsert', 'v2'), { compact: true });
    expect(store.items[0]).toMatchObject({ attempts: 0, lastError: null, nextAttemptAt: 0 });
  });

  it('un cambio que se está enviando no se toca: el nuevo va detrás', async () => {
    const sent: unknown[] = [];
    let outbox!: ReturnType<typeof setup>['outbox'];
    const ctx = setup(async (item) => {
      sent.push(item.payload);
      if (item.payload === 'v1') outbox.enqueue(tx('t1', 'upsert', 'v2'), { compact: true });
      return { status: 'sent' };
    });
    outbox = ctx.outbox;
    outbox.enqueue(tx('t1', 'upsert', 'v1'), { compact: true });
    await outbox.flush();
    expect(sent).toEqual(['v1', 'v2']);
  });

  it('sin compact, cada cambio se encola aparte (perfil, onboarding)', () => {
    const { store, outbox } = setup();
    outbox.enqueue(change('u1', 'a'));
    outbox.enqueue(change('u1', 'b'));
    expect(store.items).toHaveLength(2);
  });
});
