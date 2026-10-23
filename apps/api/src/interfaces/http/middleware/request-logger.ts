import type { MiddlewareHandler } from 'hono';
import type { Logger } from '../../../infrastructure/logging/logger';

/**
 * Registra método, ruta, estado y duración. La ruta se toma SIN query string (los enlaces de
 * correo llevan el token ahí) y nunca se registran cuerpos ni encabezados.
 */
export function requestLogger(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now();
    await next();
    logger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round(performance.now() - start),
      },
      'request',
    );
  };
}
