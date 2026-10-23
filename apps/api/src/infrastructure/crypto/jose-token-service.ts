import { jwtVerify, SignJWT } from 'jose';
import type { AccessTokenClaims, Clock, TokenService } from '../../application/ports/services';

const ACCESS_TOKEN_TTL_SEC = 15 * 60;

/** JWT HS256 de vida corta con los claims `sub` (usuario) y `sid` (sesión). */
export class JoseTokenService implements TokenService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly clock: Clock,
    private readonly ttlSec: number = ACCESS_TOKEN_TTL_SEC,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async signAccess({ sub, sid }: AccessTokenClaims): Promise<{ token: string; expiresAt: Date }> {
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    const expiresAtSec = issuedAt + this.ttlSec;
    const token = await new SignJWT({ sid })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(sub)
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAtSec)
      .sign(this.key);
    return { token, expiresAt: new Date(expiresAtSec * 1000) };
  }

  async verifyAccess(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        currentDate: this.clock.now(),
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
      return { sub: payload.sub, sid: payload.sid };
    } catch {
      return null;
    }
  }
}
