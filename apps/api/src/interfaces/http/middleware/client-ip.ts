import { isIP } from 'node:net';
import type { Context, MiddlewareHandler } from 'hono';
import { getConnInfo } from 'hono/bun';
import type { AppEnv } from '../context';

/**
 * Resuelve la IP del cliente.
 *
 * - Con `trustedProxyHops = 0` (por defecto) se usa la IP del socket y se IGNORA `X-Forwarded-For`,
 *   porque sin un proxy delante cualquiera podría falsificar ese encabezado.
 * - Con N > 0 hay N proxies de confianza: el cliente es la N-ésima IP contando desde la derecha.
 */
export function resolveClientIp(
  socketIp: string | undefined,
  forwardedFor: string | undefined,
  trustedProxyHops: number,
): string {
  const fallback = socketIp ?? 'unknown';
  if (trustedProxyHops <= 0 || !forwardedFor) return fallback;

  const chain = forwardedFor.split(',').map((part) => part.trim());
  const candidate = chain[chain.length - trustedProxyHops];
  if (candidate === undefined || isIP(candidate) === 0) return fallback;
  return candidate;
}

function socketIpFromBun(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address;
  } catch {
    // Sin servidor real (por ejemplo, `app.request()` en pruebas) no hay socket.
    return undefined;
  }
}

export interface ClientIpOptions {
  trustedProxyHops: number;
  /** Se puede reemplazar en pruebas. */
  getSocketIp?: (c: Context) => string | undefined;
}

export function clientIp(options: ClientIpOptions): MiddlewareHandler<AppEnv> {
  const getSocketIp = options.getSocketIp ?? socketIpFromBun;
  return async (c, next) => {
    c.set(
      'clientIp',
      resolveClientIp(getSocketIp(c), c.req.header('x-forwarded-for'), options.trustedProxyHops),
    );
    await next();
  };
}
