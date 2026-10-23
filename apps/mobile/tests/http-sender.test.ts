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
