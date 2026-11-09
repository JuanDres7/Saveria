/** Un código por cada valor de `Error.code` del contrato (contracts/openapi.yaml). */
export type ErrorCode =
  | 'validation_error'
  | 'invalid_credentials'
  | 'unauthorized'
  | 'too_many_attempts'
  | 'email_unavailable'
  | 'policy_not_accepted'
  | 'email_already_verified'
  | 'primary_currency_required'
  | 'account_deleted'
  | 'not_found'
  | 'internal_error';

/** Los mensajes de autenticación son genéricos a propósito: no revelan si un correo existe. */
const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  validation_error: 'Los datos enviados no son válidos',
  invalid_credentials: 'Correo o contraseña incorrectos',
  unauthorized: 'Tu sesión no es válida. Inicia sesión de nuevo',
  too_many_attempts: 'Demasiados intentos. Intenta de nuevo más tarde',
  email_unavailable: 'No se pudo crear la cuenta con ese correo',
  policy_not_accepted: 'Debes aceptar la política de tratamiento de datos',
  email_already_verified: 'El correo ya está verificado',
  primary_currency_required: 'Elige tu moneda principal para continuar',
  account_deleted: 'Esta cuenta ya no existe',
  not_found: 'No encontrado',
  internal_error: 'Ocurrió un error inesperado',
};

export interface DomainErrorOptions {
  message?: string;
  /** Errores por campo (solo en `validation_error`) */
  fields?: Record<string, string>;
  /** Segundos de espera (solo en `too_many_attempts`) */
  retryAfterSec?: number;
}

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;
  readonly retryAfterSec?: number;

  constructor(code: ErrorCode, options: DomainErrorOptions = {}) {
    super(options.message ?? DEFAULT_MESSAGES[code]);
    this.name = 'DomainError';
    this.code = code;
    this.fields = options.fields;
    this.retryAfterSec = options.retryAfterSec;
  }
}
