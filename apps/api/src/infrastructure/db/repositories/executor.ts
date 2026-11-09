import type { Database } from '../client';

/** Lo que usan los repositorios: la base o una transacción (ambas exponen estos métodos). */
export type DbExecutor = Pick<Database, 'select' | 'insert' | 'update' | 'delete'>;

/** Código de error de Postgres para violación de unicidad. */
const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  const causeCode = (error as { cause?: { code?: string } } | null)?.cause?.code;
  return code === UNIQUE_VIOLATION || causeCode === UNIQUE_VIOLATION;
}
