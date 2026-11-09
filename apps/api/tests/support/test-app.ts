import Redis from 'ioredis';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/config';
import { createContainer } from '../../src/container';
import { createLogger } from '../../src/infrastructure/logging/logger';
import { createTestDb, resetDatabase, TEST_DATABASE_URL } from './db';
import { FakeClock } from './fake-clock';
import { FakeEmailSender } from './in-memory';

/** Redis de pruebas: la base 1, para no tocar los datos de desarrollo (base 0). */
export const TEST_REDIS_URL = process.env.REDIS_URL_TEST ?? 'redis://localhost:6379/1';

export const TEST_JWT_SECRET = 'secreto-de-pruebas-'.padEnd(48, 'x');
export const TEST_CLIENT_IP = '203.0.113.10';

export interface TestAppOptions {
  /** IP de socket que verá la aplicación (por defecto 203.0.113.10) */
  socketIp?: string;
  trustedProxyHops?: number;
}

/**
 * Aplicación real (Postgres y Redis de pruebas) con reloj, correo y logger controlables.
 * Llama a `reset()` antes de cada prueba y a `close()` al terminar el archivo.
 */
export async function createTestApp(options: TestAppOptions = {}) {
  if (new URL(TEST_REDIS_URL).pathname === '/0' || new URL(TEST_REDIS_URL).pathname === '') {
    throw new Error('Las pruebas no pueden usar la base 0 de Redis (es la de desarrollo)');
  }

  const config = loadConfig({
    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: TEST_REDIS_URL,
    JWT_SECRET: TEST_JWT_SECRET,
    PUBLIC_BASE_URL: 'http://localhost:8000',
    EMAIL_PROVIDER: 'dev-outbox',
    EMAIL_FROM: 'Saveria <pruebas@example.com>',
    TRUSTED_PROXY_HOPS: String(options.trustedProxyHops ?? 0),
    NODE_ENV: 'test',
  });

  const clock = new FakeClock();
  const emails = new FakeEmailSender();
  const logLines: string[] = [];
  const logger = createLogger('info', { write: (line: string) => void logLines.push(line) });

  const container = createContainer(config, { clock, emailSender: emails, logger });
  const app = createApp(container, { getSocketIp: () => options.socketIp ?? TEST_CLIENT_IP });

  const { client } = createTestDb();
  const redis = new Redis(TEST_REDIS_URL);
  const initialTime = clock.now();

  return {
    app,
    container,
    clock,
    emails,
    logLines,
    async reset() {
      await resetDatabase(client);
      await redis.flushdb();
      emails.sent.length = 0;
      logLines.length = 0;
      clock.set(initialTime);
    },
    async close() {
      await container.close();
      await client.end();
      await redis.quit();
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
