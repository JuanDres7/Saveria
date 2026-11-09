import { createHttpSender } from '../src/outbox/http-sender';
import type { OutboxItem } from '../src/outbox/outbox';

const BASE = 'http://api.test';

const item = (payload: unknown): OutboxItem => ({
  id: '1',
  entity: 'profile',
  entityId: 'u1',
  operation: 'upsert',
  payload,
  createdAt: 0,
  attempts: 0,
  lastError: null,
  nextAttemptAt: 0,
});

const PROFILE = { method: 'PUT', path: '/v1/me/profile', body: { aiName: 'Savi' } };

describe('createHttpSender', () => {
  it('arma la petición con método, ruta y cuerpo JSON', async () => {
    const requests: Request[] = [];
    const send = createHttpSender(async (request) => {
      requests.push(request);
      return new Response(null, { status: 200 });
    }, BASE);

    expect(await send(item(PROFILE))).toEqual({ status: 'sent' });
    expect(requests[0]?.method).toBe('PUT');
    expect(requests[0]?.url).toBe(`${BASE}/v1/me/profile`);
    expect(await requests[0]?.json()).toEqual({ aiName: 'Savi' });
  });

  it.each([401, 429, 500, 503])('un %s es pasajero: se reintenta', async (status) => {
    const send = createHttpSender(async () => new Response(null, { status }), BASE);
    expect((await send(item(PROFILE))).status).toBe('retry');
  });

  it.each([400, 404, 409, 422])('un %s no tiene arreglo: se descarta', async (status) => {
    const send = createHttpSender(async () => new Response(null, { status }), BASE);
    expect((await send(item(PROFILE))).status).toBe('discard');
  });

  it('un 409 entrega la versión del servidor al manejador de conflictos y se descarta', async () => {
    const onConflict = jest.fn();
    const server = { aiName: 'Servidor', updatedAt: '2026-10-22T14:00:00.000Z' };
    const send = createHttpSender(
      async () =>
        new Response(JSON.stringify(server), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      BASE,
      { onConflict },
    );
    expect((await send(item(PROFILE))).status).toBe('discard');
    expect(onConflict).toHaveBeenCalledWith(expect.objectContaining({ entity: 'profile' }), server);
  });

  it.each([400, 404, 422])(
    'un %s llama a onRejected con el cuerpo del servidor (FR-037)',
    async (status) => {
      const onRejected = jest.fn();
      const body = { code: 'validation_error', message: 'Datos inválidos' };
      const send = createHttpSender(
        async () =>
          new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          }),
        BASE,
        { onRejected },
      );
      expect((await send(item(PROFILE))).status).toBe('discard');
      expect(onRejected).toHaveBeenCalledWith(expect.objectContaining({ entity: 'profile' }), body);
    },
  );

  it('un DELETE rechazado también llama a onRejected', async () => {
    const onRejected = jest.fn();
    const send = createHttpSender(async () => new Response('{}', { status: 400 }), BASE, {
      onRejected,
    });
    await send(item({ method: 'DELETE', path: '/v1/transactions/t1', body: { updatedAt: 'x' } }));
    expect(onRejected).toHaveBeenCalledTimes(1);
  });

  it('401, 409 y 429 no llaman a onRejected', async () => {
    for (const status of [401, 409, 429]) {
      const onRejected = jest.fn();
      const send = createHttpSender(async () => new Response('{}', { status }), BASE, {
        onRejected,
      });
      await send(item(PROFILE));
      expect(onRejected).not.toHaveBeenCalled();
    }
  });

  it('un 2xx llama a onSent', async () => {
    const onSent = jest.fn();
    const send = createHttpSender(async () => new Response(null, { status: 204 }), BASE, {
      onSent,
    });
    expect((await send(item(PROFILE))).status).toBe('sent');
    expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ entity: 'profile' }));
  });

  it('sin red se reintenta', async () => {
    const send = createHttpSender(async () => {
      throw new TypeError('Network request failed');
    }, BASE);
    expect((await send(item(PROFILE))).status).toBe('retry');
  });

  it('un payload sin método o ruta se descarta sin llamar a la red', async () => {
    const fetchImpl = jest.fn();
    const send = createHttpSender(fetchImpl, BASE);
    expect((await send(item({ foo: 1 }))).status).toBe('discard');
    expect((await send(item({ method: 'PUT', path: 'sin-barra' }))).status).toBe('discard');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
