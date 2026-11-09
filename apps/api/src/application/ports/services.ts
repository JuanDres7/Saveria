/** Puertos de servicios. Los casos de uso solo conocen estas interfaces. */

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  /**
   * Hace el mismo trabajo que `verify` contra un hash ficticio, para que una cuenta inexistente
   * tarde igual que una existente (anti-enumeración por tiempo).
   */
  verifyDummy(password: string): Promise<void>;
}

export interface AccessTokenClaims {
  /** id del usuario */
  sub: string;
  /** id de la sesión */
  sid: string;
}

export interface TokenService {
  signAccess(claims: AccessTokenClaims): Promise<{ token: string; expiresAt: Date }>;
  /** Devuelve `null` si la firma es inválida o el token venció. */
  verifyAccess(token: string): Promise<AccessTokenClaims | null>;
}

export interface Clock {
  now(): Date;
}

export interface Random {
  /** `bytes` bytes aleatorios en base64url */
  token(bytes: number): string;
  uuidV7(): string;
  sha256Hex(input: string): string;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export interface RateLimiter {
  /**
   * Cuenta un intento. `allowed` es `true` mientras el contador no supere `limit`; la ventana de
   * `windowSec` empieza con el primer intento.
   */
  hit(key: string, limit: number, windowSec: number): Promise<RateLimitResult>;
  /**
   * Devuelve un intento contado con `hit` que al final no fue un fallo (bloqueado, correcto o con
   * un error inesperado). No baja de 0 ni cambia la ventana.
   *
   * Para limitar fallos se cuenta ANTES de verificar y se devuelve después: así varias peticiones
   * en paralelo no pueden pasar todas antes de que se cuente la primera.
   */
  release(key: string): Promise<void>;
  reset(key: string): Promise<void>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Arma el contenido de cada correo. Solo lo necesario para la acción (FR-036). */
export interface EmailTemplates {
  verifyEmail(input: { to: string; link: string }): EmailMessage;
  resetPassword(input: { to: string; link: string }): EmailMessage;
}
