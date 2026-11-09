import type { PasswordHasher } from '../../application/ports/services';

const BCRYPT_COST = 12;

/**
 * Hash bcrypt (costo 12) de una contraseña aleatoria que nadie conoce. Sirve para que verificar
 * una cuenta inexistente tarde lo mismo que verificar una real.
 */
const DUMMY_HASH = '$2b$12$o41.22lt/gJluJXiOjMXqe7qmY.NXx9VulGeanfdCAsjqNdqPz02i';

/** bcrypt con `Bun.password`. Las contraseñas de más de 72 bytes las pre-hashea Bun con SHA-512. */
export class BunPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return Bun.password.hash(password, { algorithm: 'bcrypt', cost: BCRYPT_COST });
  }

  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await Bun.password.verify(password, hash);
    } catch {
      // Un hash con formato inválido nunca debe dejar entrar.
      return false;
    }
  }

  async verifyDummy(password: string): Promise<void> {
    await Bun.password.verify(password, DUMMY_HASH);
  }
}
