import type { Redis } from 'ioredis';
import type { RateLimiter, RateLimitResult } from '../../application/ports/services';

/** Resta 1 solo si la clave existe y es mayor que 0. DECR conserva el vencimiento. */
const RELEASE_SCRIPT = `
if tonumber(redis.call('GET', KEYS[1]) or '0') > 0 then
  return redis.call('DECR', KEYS[1])
end
return 0
`;

/** Contadores con vencimiento en Redis. La ventana empieza con el primer intento. */
export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis) {}

  async hit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
    const results = await this.redis
      .multi()
      .incr(key)
      // NX: solo fija el vencimiento en el primer intento, para que la ventana no se renueve
      .expire(key, windowSec, 'NX')
      .ttl(key)
      .exec();
    if (!results) throw new Error('Redis: la transacción del limitador no devolvió resultado');

    const count = Number(results[0]?.[1]);
    const ttl = Number(results[2]?.[1]);
    const allowed = count <= limit;
    return { allowed, retryAfterSec: allowed ? 0 : Math.max(ttl, 1) };
  }

  async release(key: string): Promise<void> {
    // En un script para que sea atómico. Si la clave ya venció no se crea de nuevo: un DECR suelto
    // la dejaría en -1 y sin vencimiento, regalando intentos para siempre.
    await this.redis.eval(RELEASE_SCRIPT, 1, key);
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
