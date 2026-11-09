import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { createSaveAccount } from '../../../application/use-cases/save-account';
import type { AppEnv } from '../context';
import { validate } from '../validate';

export interface AccountRoutesDeps {
  auth: MiddlewareHandler<AppEnv>;
  saveAccount: ReturnType<typeof createSaveAccount>;
}

const idParam = z.object({ id: z.uuid() });

// Solo la forma: las reglas de la cuenta y las que dependen de las demás cuentas las aplica el
// caso de uso con las validaciones compartidas.
const accountSchema = z.object({
  name: z.string().max(200),
  type: z.string().max(20),
  currency: z.string().max(10),
  initialBalance: z.string().max(32),
  isDefault: z.boolean(),
  archivedAt: z.iso.datetime({ offset: true }).nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
});

export function accountRoutes(deps: AccountRoutesDeps) {
  const app = new Hono<AppEnv>();
  app.use(deps.auth);

  // Last-write-wins: si el servidor tiene una versión igual o más nueva responde 409 con ella.
  app.put('/:id', validate('param', idParam), validate('json', accountSchema), async (c) => {
    const result = await deps.saveAccount(
      c.get('userId'),
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return c.json(result.account, result.status === 'saved' ? 200 : 409);
  });

  return app;
}
