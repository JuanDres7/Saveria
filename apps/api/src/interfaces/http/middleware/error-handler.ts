import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { DomainError, type ErrorCode } from '../../../domain/errors';
import type { Logger } from '../../../infrastructure/logging/logger';

/** Estado HTTP de cada error de dominio, según contracts/openapi.yaml. */
const STATUS_BY_CODE: Record<ErrorCode, ContentfulStatusCode> = {
  validation_error: 400,
  invalid_credentials: 401,
  unauthorized: 401,
  account_deleted: 401,
  too_many_attempts: 429,
  email_unavailable: 409,
  email_already_verified: 409,
  policy_not_accepted: 422,
  primary_currency_required: 422,
  not_found: 404,
  internal_error: 500,
};

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  fields?: Record<string, string>;
}

export function errorResponse(c: Context, error: DomainError): Response {
  const body: ErrorBody = { code: error.code, message: error.message };
  if (error.fields) body.fields = error.fields;
  if (error.code === 'too_many_attempts' && error.retryAfterSec !== undefined) {
    c.header('Retry-After', String(error.retryAfterSec));
  }
  return c.json(body, STATUS_BY_CODE[error.code]);
}

export function createErrorHandler(logger: Logger, isProduction: boolean): ErrorHandler {
  return (error, c) => {
    if (error instanceof DomainError) return errorResponse(c, error);

    // Errores propios de Hono (por ejemplo un JSON mal formado): son datos inválidos del cliente.
    if (error instanceof HTTPException && error.status === 400) {
      return errorResponse(c, new DomainError('validation_error'));
    }

    // El mensaje puede contener datos sensibles (consultas, valores), así que en producción solo
    // se registra el tipo de error.
    logger.error(
      {
        method: c.req.method,
        path: c.req.path,
        errorName: error.name,
        errorCode: (error as { code?: string }).code,
        ...(isProduction ? {} : { errorMessage: error.message }),
      },
      'unhandled error',
    );
    // Nunca se exponen detalles internos al cliente.
    return errorResponse(c, new DomainError('internal_error'));
  };
}

export const notFoundHandler: NotFoundHandler = (c) =>
  errorResponse(c, new DomainError('not_found'));
