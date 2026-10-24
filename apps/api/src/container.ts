import { fileURLToPath } from 'node:url';
import Redis from 'ioredis';
import type { Repositories, UnitOfWork } from './application/ports/repositories';
import type {
  Clock,
  EmailSender,
  EmailTemplates,
  PasswordHasher,
  Random,
  RateLimiter,
  TokenService,
} from './application/ports/services';
import type { Config } from './config';
import { BunPasswordHasher } from './infrastructure/crypto/bun-password-hasher';
import { JoseTokenService } from './infrastructure/crypto/jose-token-service';
import { CryptoRandom, SystemClock } from './infrastructure/crypto/random';
import { createDb } from './infrastructure/db/client';
import { createRepositories, DrizzleUnitOfWork } from './infrastructure/db/repositories';
import { DevOutboxEmailSender } from './infrastructure/email/dev-outbox-sender';
import { ResendEmailSender } from './infrastructure/email/resend-sender';
import { ResilientEmailSender } from './infrastructure/email/resilient-email-sender';
import { emailTemplates } from './infrastructure/email/templates';
import { createLogger, type Logger } from './infrastructure/logging/logger';
import { RedisRateLimiter } from './infrastructure/redis/redis-rate-limiter';

/** Todo lo que necesita la aplicación, ya instanciado. Los casos de uso reciben solo puertos. */
export interface Container {
  config: Config;
  logger: Logger;
  clock: Clock;
  random: Random;
  hasher: PasswordHasher;
  tokens: TokenService;
  rateLimiter: RateLimiter;
  emailSender: EmailSender;
  emailTemplates: EmailTemplates;
  /** Base de los enlaces que van en los correos (`PUBLIC_BASE_URL`). */
  publicBaseUrl: string;
  repositories: Repositories;
  uow: UnitOfWork;
  /** Cierra conexiones y espera los correos en curso (apagado ordenado). */
  close(): Promise<void>;
}

/** Piezas que las pruebas pueden reemplazar por dobles. */
export type ContainerOverrides = Partial<Pick<Container, 'logger' | 'clock' | 'emailSender'>>;

/** Composición manual de dependencias: aquí, y solo aquí, se eligen los adaptadores concretos. */
export function createContainer(config: Config, overrides: ContainerOverrides = {}): Container {
  const logger = overrides.logger ?? createLogger(config.NODE_ENV === 'test' ? 'silent' : 'info');
  const clock = overrides.clock ?? new SystemClock();
  const { db, client } = createDb(config.DATABASE_URL);
  const redis = new Redis(config.REDIS_URL);

  const baseSender =
    config.EMAIL_PROVIDER === 'resend'
      ? new ResendEmailSender(config.RESEND_API_KEY ?? '', config.EMAIL_FROM)
      : new DevOutboxEmailSender(fileURLToPath(new URL('../.dev-outbox', import.meta.url)));
  const resilientSender = new ResilientEmailSender(baseSender, logger);
  const emailSender = overrides.emailSender ?? resilientSender;

  return {
    config,
    logger,
    clock,
    random: new CryptoRandom(),
    hasher: new BunPasswordHasher(),
    tokens: new JoseTokenService(config.JWT_SECRET, clock),
    rateLimiter: new RedisRateLimiter(redis),
    emailSender,
    emailTemplates,
    publicBaseUrl: config.PUBLIC_BASE_URL,
    repositories: createRepositories(db),
    uow: new DrizzleUnitOfWork(db),
    async close() {
      await resilientSender.flush();
      await redis.quit();
      await client.end();
    },
  };
}
