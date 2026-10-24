import type { PasswordHasher } from '../../src/application/ports/services';
import { JoseTokenService } from '../../src/infrastructure/crypto/jose-token-service';
import { CryptoRandom } from '../../src/infrastructure/crypto/random';
import { emailTemplates } from '../../src/infrastructure/email/templates/verify-email';
import { FakeClock } from './fake-clock';
import { createInMemoryPersistence, FakeEmailSender, InMemoryRateLimiter } from './in-memory';

/** Hasher instantáneo: bcrypt real (costo 12) haría lentísimas las pruebas con muchos intentos. */
export class FakePasswordHasher implements PasswordHasher {
  dummyCalls = 0;

  async hash(password: string): Promise<string> {
    return `fake:${password}`;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return hash === `fake:${password}`;
  }

  async verifyDummy(): Promise<void> {
    this.dummyCalls += 1;
  }
}

export const UNIT_PUBLIC_BASE_URL = 'https://saveria.test';

export const UNIT_JWT_SECRET = 'secreto-de-pruebas-unitarias-'.padEnd(48, 'x');

/** Todas las dependencias de los casos de uso, en memoria y con reloj controlable. */
export function createUseCaseDeps() {
  const clock = new FakeClock();
  const persistence = createInMemoryPersistence();
  return {
    ...persistence,
    clock,
    hasher: new FakePasswordHasher(),
    tokens: new JoseTokenService(UNIT_JWT_SECRET, clock),
    random: new CryptoRandom(),
    rateLimiter: new InMemoryRateLimiter(clock),
    emailSender: new FakeEmailSender(),
    emailTemplates,
    publicBaseUrl: UNIT_PUBLIC_BASE_URL,
  };
}

export type UseCaseDeps = ReturnType<typeof createUseCaseDeps>;
