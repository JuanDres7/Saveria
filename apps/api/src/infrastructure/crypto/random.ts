import type { Clock, Random } from '../../application/ports/services';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class CryptoRandom implements Random {
  token(bytes: number): string {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url');
  }

  uuidV7(): string {
    return Bun.randomUUIDv7();
  }

  sha256Hex(input: string): string {
    return new Bun.CryptoHasher('sha256').update(input).digest('hex');
  }
}
