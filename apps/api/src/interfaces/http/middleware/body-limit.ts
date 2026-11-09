import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { DomainError } from '../../../domain/errors';
import { errorResponse } from './error-handler';

export const MAX_BODY_BYTES = 16 * 1024;

/** Rechaza cuerpos de más de 16 KB. Se responde con `validation_error` (el contrato no define 413). */
export function limitBodySize(): MiddlewareHandler {
  return bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) =>
      errorResponse(
        c,
        new DomainError('validation_error', {
          message: 'El cuerpo de la petición es demasiado grande',
        }),
      ),
  });
}
