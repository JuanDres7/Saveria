import type {
  Account,
  OneTimeToken,
  OneTimeTokenKind,
  Profile,
  RevokeReason,
  Session,
  User,
} from '../../domain/entities';

/** Lo único que cambia al rotar el refresh token. */
export type SessionRotation = Pick<
  Session,
  'refreshTokenHash' | 'previousRefreshTokenHash' | 'rotatedAt' | 'lastUsedAt' | 'expiresAt'
>;

export interface UserRepository {
  /** `email_taken` si ya existe otra cuenta con ese correo (también ante una carrera). */
  create(user: User): Promise<'created' | 'email_taken'>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  markEmailVerified(id: string, at: Date): Promise<void>;
  updatePasswordHash(id: string, passwordHash: string, at: Date): Promise<void>;
  /** Cambia el correo y lo deja sin verificar. */
  updateEmail(id: string, email: string, at: Date): Promise<'updated' | 'email_taken'>;
  /** Borra el usuario; el perfil, las cuentas y los tokens se eliminan en cascada. */
  delete(id: string): Promise<void>;
}

export interface ProfileRepository {
  create(profile: Profile): Promise<void>;
  findById(userId: string): Promise<Profile | null>;
  /** Reemplaza los campos editables del perfil. */
  save(profile: Profile): Promise<void>;
}

export interface SessionRepository {
  create(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  /**
   * Rota el refresh token solo si la sesión sigue activa y su hash actual es `expectedHash`.
   * Devuelve `false` si otra petición la revocó o la rotó primero: así un refresh nunca deshace
   * una revocación hecha mientras corría.
   */
  rotate(id: string, expectedHash: string, rotation: SessionRotation): Promise<boolean>;
  revoke(id: string, reason: RevokeReason, at: Date): Promise<void>;
  /** Revoca las sesiones activas del usuario, salvo `exceptSessionId`. */
  revokeAllForUser(
    userId: string,
    reason: RevokeReason,
    at: Date,
    exceptSessionId?: string,
  ): Promise<void>;
  /** Revoca las sesiones activas de ese dispositivo (un login nuevo reemplaza a la anterior). */
  revokeActiveForDevice(
    userId: string,
    deviceId: string,
    reason: RevokeReason,
    at: Date,
  ): Promise<void>;
  /**
   * Al borrar la cuenta: marca TODAS las sesiones del usuario como `account_deleted` y borra el
   * nombre del dispositivo. Después de borrar el usuario, `user_id` queda en null.
   */
  markAccountDeleted(userId: string, at: Date): Promise<void>;
  /** Borra sesiones vencidas o revocadas antes de `before`. Devuelve cuántas borró. */
  purgeBefore(before: Date): Promise<number>;
}

export interface OneTimeTokenRepository {
  create(token: OneTimeToken): Promise<void>;
  findByHash(tokenHash: string): Promise<OneTimeToken | null>;
  /** Invalida los enlaces vigentes de ese tipo (un enlace nuevo invalida los anteriores). */
  invalidateActive(userId: string, kind: OneTimeTokenKind, at: Date): Promise<void>;
  /**
   * Marca el enlace como usado solo si nadie lo usó antes. `false` si otra petición lo consumió
   * primero (dos envíos simultáneos del mismo enlace).
   */
  markUsed(id: string, at: Date): Promise<boolean>;
  /** Borra tokens vencidos antes de `before`. Devuelve cuántos borró. */
  purgeBefore(before: Date): Promise<number>;
}

export interface AccountRepository {
  create(account: Account): Promise<void>;
  findById(id: string): Promise<Account | null>;
  findDefaultByUser(userId: string): Promise<Account | null>;
}

export interface Repositories {
  users: UserRepository;
  profiles: ProfileRepository;
  sessions: SessionRepository;
  oneTimeTokens: OneTimeTokenRepository;
  accounts: AccountRepository;
}

/** Ejecuta varias operaciones de repositorio en una sola transacción. */
export interface UnitOfWork {
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}
