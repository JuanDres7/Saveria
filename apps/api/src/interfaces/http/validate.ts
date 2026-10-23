import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodType } from 'zod';
import { DomainError } from '../../domain/errors';

/**
 * Valida con Zod y, si falla, responde con el formato de error del contrato
 * (`validation_error` + `fields`) en vez del formato por defecto del validador.
 */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (result.success) return;
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'body';
      fields[key] ??= issue.message;
    }
    throw new DomainError('validation_error', { fields });
  });
}
