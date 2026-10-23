import { emailSchema, passwordSchema } from '@saveria/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { createLogin } from '../../../application/use-cases/login';
import type { createLogout } from '../../../application/use-cases/logout';
import type { createRefresh } from '../../../application/use-cases/refresh';
import type { createRegister } from '../../../application/use-cases/register';
import { DomainError } from '../../../domain/errors';
import type { AppEnv } from '../context';
import { validate } from '../validate';

export interface AuthRoutesDeps {
  register: ReturnType<typeof createRegister>;
  login: ReturnType<typeof createLogin>;
  refresh: ReturnType<typeof createRefresh>;
  logout: ReturnType<typeof createLogout>;
}

const deviceSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().max(80).optional(),
});

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  // `false` o una versión desconocida no son errores de formato: el caso de uso responde
  // `policy_not_accepted` (422).
  policyVersion: z.string().max(40),
  policyAccepted: z.boolean(),
  device: deviceSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  // Sin las reglas de contraseña nueva: una contraseña corta y mala es `invalid_credentials`.
  password: z.string().min(1).max(1024),
  device: deviceSchema,
});

const refreshTokenSchema = z.string().min(20).max(200);

const BEARER = /^Bearer ([A-Za-z0-9._-]+)$/;

/** Lee el cuerpo JSON sin fallar: logout y refresh no responden 400 ante un cuerpo inválido. */
async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    return body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function authRoutes(deps: AuthRoutesDeps) {
  const app = new Hono<AppEnv>();

  app.post('/register', validate('json', registerSchema), async (c) =>
    c.json(await deps.register(c.req.valid('json')), 201),
  );

  app.post('/login', validate('json', loginSchema), async (c) =>
    c.json(await deps.login({ ...c.req.valid('json'), ip: c.get('clientIp') })),
  );

  // El contrato solo documenta 200 y 401: un token ausente o mal formado es simplemente inválido.
  app.post('/refresh', async (c) => {
    const parsed = refreshTokenSchema.safeParse((await readJson(c.req.raw)).refreshToken);
    if (!parsed.success) throw new DomainError('unauthorized');
    return c.json(await deps.refresh(parsed.data));
  });

  // Responde 204 siempre, haya o no algo que revocar (FR-009).
  app.post('/logout', async (c) => {
    const accessToken = BEARER.exec(c.req.header('authorization') ?? '')?.[1] ?? null;
    const parsed = refreshTokenSchema.safeParse((await readJson(c.req.raw)).refreshToken);
    await deps.logout({ accessToken, refreshToken: parsed.success ? parsed.data : null });
    return c.body(null, 204);
  });

  return app;
}
