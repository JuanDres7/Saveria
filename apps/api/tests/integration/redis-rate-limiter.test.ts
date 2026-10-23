import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import Redis from 'ioredis';
import { RedisRateLimiter } from '../../src/infrastructure/redis/redis-rate-limiter';

describe('RedisRateLimiter (Redis real)', () => {
  let redis: Redis;
  let limiter: RedisRateLimiter;
  const keys: string[] = [];
  const newKey = () => {
    const key = `rl:test:${crypto.randomUUID()}`;
    keys.push(key);
    return key;
  };

  beforeAll(() => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    limiter = new RedisRateLimiter(redis);
  });
  afterEach(async () => {
    if (keys.length) await redis.del(...keys.splice(0));
  });
  afterAll(async () => {
    await redis.quit();
  });

  it('permite hasta el límite y bloquea el intento siguiente', async () => {
    const key = newKey();
    for (let i = 1; i <= 5; i++) {
      expect((await limiter.hit(key, 5, 900)).allowed).toBe(true);
    }
    const blocked = await limiter.hit(key, 5, 900);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(900);
  });

  it('la ventana empieza con el primer intento y no se renueva', async () => {
    const key = newKey();
    await limiter.hit(key, 5, 100);
    const ttlBefore = await redis.ttl(key);
    await limiter.hit(key, 5, 100);
    const ttlAfter = await redis.ttl(key);
    expect(ttlBefore).toBeGreaterThan(0);
    expect(ttlAfter).toBeLessThanOrEqual(ttlBefore);
  });

  it('peek no cuenta intentos', async () => {
    const key = newKey();
    for (let i = 0; i < 10; i++) {
      expect((await limiter.peek(key, 3)).allowed).toBe(true);
    }
    expect(await redis.get(key)).toBeNull();
  });

  it('peek bloquea cuando el contador alcanzó el límite', async () => {
    const key = newKey();
    for (let i = 0; i < 3; i++) await limiter.hit(key, 3, 900);
    const result = await limiter.peek(key, 3);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });

  it('reset borra el contador', async () => {
    const key = newKey();
    for (let i = 0; i < 6; i++) await limiter.hit(key, 5, 900);
    await limiter.reset(key);
    expect((await limiter.hit(key, 5, 900)).allowed).toBe(true);
  });

  it('los contadores de claves distintas son independientes', async () => {
    const a = newKey();
    const b = newKey();
    for (let i = 0; i < 6; i++) await limiter.hit(a, 5, 900);
    expect((await limiter.hit(b, 5, 900)).allowed).toBe(true);
  });
});
