import { fileURLToPath } from 'node:url';
import { Scalar } from '@scalar/hono-api-reference';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { Container } from './container';
import type { AppEnv } from './interfaces/http/context';
import { limitBodySize } from './interfaces/http/middleware/body-limit';
import { clientIp } from './interfaces/http/middleware/client-ip';
import { createErrorHandler, notFoundHandler } from './interfaces/http/middleware/error-handler';
import { requestLogger } from './interfaces/http/middleware/request-logger';

/** Lo que `createApp` necesita del contenedor; las pruebas pueden pasar un subconjunto. */
export type AppDeps = Pick<Container, 'config' | 'logger'> & Partial<Container>;

export interface AppOptions {
  /** Reemplaza la resolución de la IP del socket (solo para pruebas). */
  getSocketIp?: Parameters<typeof clientIp>[0]['getSocketIp'];
}

const OPENAPI_FILE = fileURLToPath(
  new URL('../../../specs/001-auth-onboarding/contracts/openapi.yaml', import.meta.url),
);

export function createApp(deps: AppDeps, options: AppOptions = {}) {
  const { config, logger } = deps;
  const app = new Hono<AppEnv>();

  app.onError(createErrorHandler(logger, config.NODE_ENV === 'production'));
  app.notFound(notFoundHandler);

  app.use(requestLogger(logger));
  app.use(secureHeaders());
  app.use(limitBodySize());
  app.use(
    clientIp({ trustedProxyHops: config.TRUSTED_PROXY_HOPS, getSocketIp: options.getSocketIp }),
  );

  app.get('/health', (c) => c.json({ status: 'ok' }));

  // El contrato navegable solo existe fuera de producción.
  if (config.NODE_ENV !== 'production') {
    app.get('/docs/openapi.yaml', (c) =>
      c.body(Bun.file(OPENAPI_FILE).stream(), 200, { 'content-type': 'application/yaml' }),
    );
    app.get('/docs', Scalar({ url: '/docs/openapi.yaml' }));
  }

  return app;
}

export type App = ReturnType<typeof createApp>;
