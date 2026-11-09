import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { z } from 'zod';
import { DomainError } from '../../src/domain/errors';
import { createLogger } from '../../src/infrastructure/logging/logger';
import type { AppEnv } from '../../src/interfaces/http/context';
import { limitBodySize } from '../../src/interfaces/http/middleware/body-limit';
import { clientIp, resolveClientIp } from '../../src/interfaces/http/middleware/client-ip';
import {
  createErrorHandler,
  notFoundHandler,
} from '../../src/interfaces/http/middleware/error-handler';
import { requestLogger } from '../../src/interfaces/http/middleware/request-logger';
import { validate } from '../../src/interfaces/http/validate';
import { jsonBody } from '../support/http';

function capturingLogger() {
  const lines: string[] = [];
  const logger = createLogger('info', { write: (line: string) => void lines.push(line) });
  return { lines, logger };
}

describe('resolveClientIp', () => {
  it('sin proxies de confianza usa la IP del socket e ignora X-Forwarded-For', () => {
    expect(resolveClientIp('10.0.0.5', '1.2.3.4', 0)).toBe('10.0.0.5');
  });

  it('con un proxy toma la última IP de X-Forwarded-For', () => {
    expect(resolveClientIp('10.0.0.5', '203.0.113.9', 1)).toBe('203.0.113.9');
  });

  it('con un proxy ignora lo que el cliente haya antepuesto para falsificar su IP', () => {
    expect(resolveClientIp('10.0.0.5', '6.6.6.6, 203.0.113.9', 1)).toBe('203.0.113.9');
  });

  it('con dos proxies toma la segunda IP desde la derecha', () => {
    expect(resolveClientIp('10.0.0.5', '203.0.113.9, 172.16.0.2', 2)).toBe('203.0.113.9');
  });

  it('si la cadena tiene menos IPs que proxies, usa la del socket', () => {
    expect(resolveClientIp('10.0.0.5', '203.0.113.9', 2)).toBe('10.0.0.5');
  });

  it('si la IP del encabezado no es válida, usa la del socket', () => {
    expect(resolveClientIp('10.0.0.5', 'no-es-una-ip', 1)).toBe('10.0.0.5');
  });

  it('si no hay socket ni encabezado devuelve "unknown"', () => {
    expect(resolveClientIp(undefined, undefined, 0)).toBe('unknown');
  });

  it('el middleware deja la IP en el contexto', async () => {
    const app = new Hono<AppEnv>();
    app.use(clientIp({ trustedProxyHops: 1, getSocketIp: () => '10.0.0.5' }));
    app.get('/ip', (c) => c.text(c.get('clientIp')));
    const res = await app.request('/ip', { headers: { 'x-forwarded-for': '203.0.113.9' } });
    expect(await res.text()).toBe('203.0.113.9');
  });
});

describe('requestLogger', () => {
  it('registra método, ruta, estado y duración sin query string, cuerpo ni encabezados', async () => {
    const { lines, logger } = capturingLogger();
    const app = new Hono();
    app.use(requestLogger(logger));
    app.post('/links/verify-email', (c) => c.text('ok'));

    await app.request('/links/verify-email?token=TOKEN-SECRETO', {
      method: 'POST',
      headers: { authorization: 'Bearer JWT-SECRETO' },
      body: JSON.stringify({ password: 'clave1234' }),
    });

    const output = lines.join('');
    const entry = JSON.parse(lines[0] ?? '{}');
    expect(entry).toMatchObject({ method: 'POST', path: '/links/verify-email', status: 200 });
    expect(typeof entry.durationMs).toBe('number');
    for (const secret of ['TOKEN-SECRETO', 'JWT-SECRETO', 'clave1234']) {
      expect(output).not.toContain(secret);
    }
  });
});

describe('manejo de errores', () => {
  function appWith(isProduction = true) {
    const { lines, logger } = capturingLogger();
    const app = new Hono();
    app.onError(createErrorHandler(logger, isProduction));
    app.notFound(notFoundHandler);
    app.get('/domain/:code', (c) => {
      throw new DomainError(c.req.param('code') as never);
    });
    app.get('/limited', () => {
      throw new DomainError('too_many_attempts', { retryAfterSec: 120 });
    });
    app.get('/boom', () => {
      throw new Error('fallo interno: password=clave1234 en la consulta');
    });
    return { app, lines };
  }

  it.each([
    ['validation_error', 400],
    ['invalid_credentials', 401],
    ['unauthorized', 401],
    ['account_deleted', 401],
    ['too_many_attempts', 429],
    ['email_unavailable', 409],
    ['email_already_verified', 409],
    ['policy_not_accepted', 422],
    ['primary_currency_required', 422],
    ['not_found', 404],
  ] as const)('un error %s responde %i con el formato del contrato', async (code, status) => {
    const { app } = appWith();
    const res = await app.request(`/domain/${code}`);
    expect(res.status).toBe(status);
    const body = await jsonBody(res);
    expect(body.code).toBe(code);
    expect(typeof body.message).toBe('string');
  });

  it('too_many_attempts incluye el encabezado Retry-After', async () => {
    const { app } = appWith();
    const res = await app.request('/limited');
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('120');
  });

  it('un error inesperado responde 500 sin exponer detalles y no registra el mensaje en producción', async () => {
    const { app, lines } = appWith(true);
    const res = await app.request('/boom');
    expect(res.status).toBe(500);
    const body = await jsonBody(res);
    expect(body.code).toBe('internal_error');
    expect(JSON.stringify(body)).not.toContain('clave1234');
    expect(lines.join('')).not.toContain('clave1234');
    expect(lines.join('')).toContain('unhandled error');
  });

  it('fuera de producción sí registra el mensaje para poder depurar', async () => {
    const { app, lines } = appWith(false);
    await app.request('/boom');
    expect(lines.join('')).toContain('fallo interno');
  });

  it('una ruta inexistente responde 404 not_found', async () => {
    const { app } = appWith();
    const res = await app.request('/no-existe');
    expect(res.status).toBe(404);
    expect((await jsonBody(res)).code).toBe('not_found');
  });

  it('un JSON mal formado responde 400 validation_error', async () => {
    const { logger } = capturingLogger();
    const app = new Hono();
    app.onError(createErrorHandler(logger, true));
    app.post('/x', validate('json', z.object({ a: z.string() })), (c) => c.text('ok'));
    const res = await app.request('/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{no es json',
    });
    expect(res.status).toBe(400);
    expect((await jsonBody(res)).code).toBe('validation_error');
  });
});

describe('validate', () => {
  function appWithValidation() {
    const { logger } = capturingLogger();
    const app = new Hono();
    app.onError(createErrorHandler(logger, true));
    app.post('/x', validate('json', z.object({ email: z.email(), age: z.number() })), (c) =>
      c.json(c.req.valid('json')),
    );
    return app;
  }

  it('responde validation_error con los errores por campo', async () => {
    const res = await appWithValidation().request('/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'no-es-correo', age: 'veinte' }),
    });
    expect(res.status).toBe(400);
    const body = await jsonBody(res);
    expect(body.code).toBe('validation_error');
    expect(Object.keys(body.fields).sort()).toEqual(['age', 'email']);
  });

  it('deja pasar datos válidos', async () => {
    const res = await appWithValidation().request('/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ana@mail.com', age: 20 }),
    });
    expect(res.status).toBe(200);
  });
});

describe('límite de cuerpo', () => {
  function appWithLimit() {
    const { logger } = capturingLogger();
    const app = new Hono();
    app.onError(createErrorHandler(logger, true));
    app.use(limitBodySize());
    app.post('/x', async (c) => c.json({ size: (await c.req.text()).length }));
    return app;
  }

  it('acepta un cuerpo de 16 KB', async () => {
    const res = await appWithLimit().request('/x', { method: 'POST', body: 'a'.repeat(16 * 1024) });
    expect(res.status).toBe(200);
  });

  it('rechaza un cuerpo de más de 16 KB con validation_error', async () => {
    const res = await appWithLimit().request('/x', {
      method: 'POST',
      body: 'a'.repeat(16 * 1024 + 1),
    });
    expect(res.status).toBe(400);
    expect((await jsonBody(res)).code).toBe('validation_error');
  });
});
