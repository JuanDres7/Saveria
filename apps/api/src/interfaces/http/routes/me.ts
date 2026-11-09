import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { createCompleteOnboarding } from '../../../application/use-cases/complete-onboarding';
import type { createDeleteAccount } from '../../../application/use-cases/delete-account';
import type { createGetMe } from '../../../application/use-cases/get-me';
import type { createUpdateProfile } from '../../../application/use-cases/update-profile';
import type { AppEnv } from '../context';
import { validate } from '../validate';

export interface MeRoutesDeps {
  auth: MiddlewareHandler<AppEnv>;
  getMe: ReturnType<typeof createGetMe>;
  updateProfile: ReturnType<typeof createUpdateProfile>;
  completeOnboarding: ReturnType<typeof createCompleteOnboarding>;
  deleteAccount: ReturnType<typeof createDeleteAccount>;
}

// Solo la forma: las reglas del perfil (catálogos, límites, monedas) las aplica el caso de uso
// con las validaciones compartidas, igual que en el registro.
const profileUpdateSchema = z.object({
  aiName: z.string().max(200).nullable(),
  countryCode: z.string().max(10).nullable(),
  city: z.string().max(200).nullable(),
  primaryCurrency: z.string().max(10).nullable(),
  referenceCurrencies: z.array(z.string().max(10)).max(10),
  aiMode: z.string().max(20),
  onboardingStep: z.string().max(20),
  updatedAt: z.iso.datetime({ offset: true }),
  autoModeConfirmed: z.boolean().optional(),
});

const completeOnboardingSchema = z.object({ defaultAccountId: z.uuid() });

const deleteAccountSchema = z.object({ password: z.string().min(1).max(1024) });

export function meRoutes(deps: MeRoutesDeps) {
  const app = new Hono<AppEnv>();
  app.use(deps.auth);

  app.get('/', async (c) => c.json(await deps.getMe(c.get('userId'))));

  app.delete('/', validate('json', deleteAccountSchema), async (c) => {
    await deps.deleteAccount({
      userId: c.get('userId'),
      ip: c.get('clientIp'),
      password: c.req.valid('json').password,
    });
    return c.body(null, 204);
  });

  // Last-write-wins: si el servidor tiene una versión igual o más nueva responde 409 con ella.
  app.put('/profile', validate('json', profileUpdateSchema), async (c) => {
    const result = await deps.updateProfile(c.get('userId'), c.req.valid('json'));
    return c.json(result.profile, result.status === 'saved' ? 200 : 409);
  });

  app.post('/onboarding/complete', validate('json', completeOnboardingSchema), async (c) =>
    c.json(await deps.completeOnboarding(c.get('userId'), c.req.valid('json').defaultAccountId)),
  );

  return app;
}
