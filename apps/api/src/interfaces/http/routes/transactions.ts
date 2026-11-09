import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { createDeleteTransaction } from '../../../application/use-cases/delete-transaction';
import type { createSaveTransaction } from '../../../application/use-cases/save-transaction';
import type { AppEnv } from '../context';
import { validate } from '../validate';

export interface TransactionRoutesDeps {
  auth: MiddlewareHandler<AppEnv>;
  saveTransaction: ReturnType<typeof createSaveTransaction>;
  deleteTransaction: ReturnType<typeof createDeleteTransaction>;
}

const idParam = z.object({ id: z.uuid() });

// Solo la forma: las reglas de cada tipo (montos, categorías, fechas, monedas) las aplica el caso
// de uso con las validaciones compartidas.
const text = (max: number) => z.string().max(max);
const deleteSchema = z.object({ updatedAt: z.iso.datetime({ offset: true }) });

const transactionSchema = z.object({
  type: text(20),
  accountId: text(64),
  amount: text(32),
  currency: text(10),
  toAccountId: text(64).nullable(),
  toAmount: text(32).nullable(),
  toCurrency: text(10).nullable(),
  categorySlug: text(64).nullable(),
  description: text(1000).nullable(),
  occurredOn: text(20),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
});

export function transactionRoutes(deps: TransactionRoutesDeps) {
  const app = new Hono<AppEnv>();
  app.use(deps.auth);

  // Last-write-wins: si el servidor tiene una versión igual o más nueva responde 409 con ella.
  app.put('/:id', validate('param', idParam), validate('json', transactionSchema), async (c) => {
    const result = await deps.saveTransaction(
      c.get('userId'),
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return c.json(result.transaction, result.status === 'saved' ? 200 : 409);
  });

  // Borrado lógico, idempotente y last-write-wins; "Deshacer" es un PUT con `deletedAt: null`.
  app.delete('/:id', validate('param', idParam), validate('json', deleteSchema), async (c) => {
    const result = await deps.deleteTransaction(
      c.get('userId'),
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return result.status === 'deleted' ? c.body(null, 204) : c.json(result.transaction, 409);
  });

  return app;
}
