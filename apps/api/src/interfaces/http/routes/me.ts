import { Hono, type MiddlewareHandler } from 'hono';
import type { createGetMe } from '../../../application/use-cases/get-me';
import type { AppEnv } from '../context';

export interface MeRoutesDeps {
  auth: MiddlewareHandler<AppEnv>;
  getMe: ReturnType<typeof createGetMe>;
}

export function meRoutes(deps: MeRoutesDeps) {
  const app = new Hono<AppEnv>();
  app.use(deps.auth);

  app.get('/', async (c) => c.json(await deps.getMe(c.get('userId'))));

  return app;
}
