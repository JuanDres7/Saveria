import { emailSchema, passwordSchema } from '@saveria/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { createChangeEmail } from '../../../application/use-cases/change-email';
import type { createChangePassword } from '../../../application/use-cases/change-password';
import type { createForgotPassword } from '../../../application/use-cases/forgot-password';
import type { createLogin } from '../../../application/use-cases/login';
import type { createLogout } from '../../../application/use-cases/logout';
import type { createRefresh } from '../../../application/use-cases/refresh';
import type { createRegister } from '../../../application/use-cases/register';
import type { createResendVerification } from '../../../application/use-cases/resend-verification';
import { DomainError } from '../../../domain/errors';
import type { AppEnv } from '../context';
import { validate } from '../validate';

export interface AuthRoutesDeps {
  register: ReturnType<typeof createRegister>;
  login: ReturnType<typeof createLogin>;
  refresh: ReturnType<typeof createRefresh>;
  logout: ReturnType<typeof createLogout>;
  changePassword: ReturnType<typeof createChangePassword>;
  resendVerification: ReturnType<typeof createResendVerification>;
  changeEmail: ReturnType<typeof createChangeEmail>;
  forgotPassword: ReturnType<typeof createForgotPassword>;
  /** Exige sesión; solo lo usan las rutas que la necesitan (las demás son públicas). */
  auth: MiddlewareHandler<AppEnv>;
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

// Solo la forma: el formato del correo lo valida el caso de uso (responde `validation_error`).
const changeEmailSchema = z.object({ email: z.string().max(320) });

/** Respuesta idéntica en todos los casos: verificado o no, y aunque se pase el límite (FR-035). */
const RESEND_MESSAGE =
  'Si tu correo aún no está verificado, te enviamos un enlace nuevo. Revisa tu bandeja de entrada.';

// Solo la forma: el formato del correo lo valida el caso de uso (responde `validation_error`).
const forgotPasswordSchema = z.object({ email: z.string().max(320) });

/** Respuesta idéntica exista o no el correo, y aunque se pase el límite (FR-030, FR-035). */
const FORGOT_MESSAGE =
  'Si el correo está registrado, te llegará un enlace para crear una contraseña nueva.';

const loginSchema = z.object({
  email: emailSchema,
  // Sin las reglas de contraseña nueva: una contraseña corta y mala es `invalid_credentials`.
  password: z.string().min(1).max(1024),
  device: deviceSchema,
});

// Solo la forma: la regla de la contraseña nueva (FR-003) la aplica el caso de uso.
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().max(1024),
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
    c.json(await deps.register({ ...c.req.valid('json'), ip: c.get('clientIp') }), 201),
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

  app.post('/password/change', deps.auth, validate('json', changePasswordSchema), async (c) => {
    await deps.changePassword({
      ...c.req.valid('json'),
      userId: c.get('userId'),
      sessionId: c.get('sessionId'),
      ip: c.get('clientIp'),
    });
    return c.body(null, 204);
  });

  app.post('/password/forgot', validate('json', forgotPasswordSchema), async (c) => {
    await deps.forgotPassword(c.req.valid('json').email);
    return c.json({ message: FORGOT_MESSAGE }, 202);
  });

  app.post('/email/verification', deps.auth, async (c) => {
    await deps.resendVerification(c.get('userId'));
    return c.json({ message: RESEND_MESSAGE }, 202);
  });

  app.put('/email', deps.auth, validate('json', changeEmailSchema), async (c) =>
    c.json(await deps.changeEmail(c.get('userId'), c.req.valid('json').email), 202),
  );

  return app;
}
