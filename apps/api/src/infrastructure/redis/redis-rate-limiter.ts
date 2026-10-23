import type { Redis } from 'ioredis';
import type { RateLimiter, RateLimitResult } from '../../application/ports/services';

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

  async peek(key: string, limit: number): Promise<RateLimitResult> {
    const results = await this.redis.multi().get(key).ttl(key).exec();
    if (!results) throw new Error('Redis: la transacción del limitador no devolvió resultado');

    const count = Number(results[0]?.[1] ?? 0);
    const ttl = Number(results[1]?.[1]);
    const allowed = count < limit;
    return { allowed, retryAfterSec: allowed ? 0 : Math.max(ttl, 1) };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
