import { z } from 'zod';
import { DomainError } from '../../domain/errors';
import type { TransactionDto } from '../dto';
import type { UnitOfWork } from '../ports/repositories';
import { toTransactionDto } from './save-transaction';

export type DeleteTransactionResult =
  | { status: 'deleted' }
  /** El servidor tiene una versión más nueva: el teléfono la adopta (409). */
  | { status: 'conflict'; transaction: TransactionDto };

const updatedAtSchema = z.iso.datetime({ offset: true });

/**
 * Borrado lógico de un movimiento (research §3): marca `deleted_at` con la hora del teléfono y
 * last-write-wins por `updatedAt`. Es idempotente: repetir el mismo borrado da el mismo resultado,
 * y borrar un id que el servidor no conoce (creado y borrado sin conexión) responde bien sin crear
 * nada. "Deshacer" no es una operación propia: es un `PUT` posterior con `deletedAt: null`.
 */
export function createDeleteTransaction({ uow }: { uow: UnitOfWork }) {
  return async function deleteTransaction(
    userId: string,
    id: string,
    input: { updatedAt: string },
  ): Promise<DeleteTransactionResult> {
    const parsed = updatedAtSchema.safeParse(input.updatedAt);
    if (!parsed.success) {
      throw new DomainError('validation_error', { fields: { updatedAt: 'Fecha inválida' } });
    }
    const updatedAt = new Date(parsed.data);

    return uow.run(async (repos) => {
      const existing = await repos.transactions.findById(id);
      if (!existing) return { status: 'deleted' };
      if (existing.userId !== userId) throw new DomainError('not_found');

      const time = existing.updatedAt.getTime();
      // El mismo borrado repetido (reintento de red): ya está hecho.
      if (existing.deletedAt !== null && time === updatedAt.getTime()) return { status: 'deleted' };
      if (time >= updatedAt.getTime()) {
        return { status: 'conflict', transaction: toTransactionDto(existing) };
      }

      await repos.transactions.upsert({ ...existing, deletedAt: updatedAt, updatedAt });
      return { status: 'deleted' };
    });
  };
}
