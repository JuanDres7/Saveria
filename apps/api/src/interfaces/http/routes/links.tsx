import { Hono, type MiddlewareHandler } from 'hono';
import { VERIFY_EMAIL_PATH } from '../../../application/use-cases/send-verification-email';
import type {
  createCheckVerificationLink,
  createVerifyEmail,
} from '../../../application/use-cases/verify-email';
import type { AppEnv } from '../context';
import {
  ConfirmEmailPage,
  EmailVerifiedPage,
  InvalidVerificationLinkPage,
} from '../pages/verify-email';

/**
 * Headers de las páginas de los enlaces (research §4). Se registra ANTES de `secureHeaders`:
 * ese middleware escribe sus valores al final, y este, al ser más externo, los reemplaza.
 */
export const linkPageHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Cache-Control', 'no-store');
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
  );
  c.header('X-Frame-Options', 'DENY');
};

export interface LinkRoutesDeps {
  checkVerificationLink: ReturnType<typeof createCheckVerificationLink>;
  verifyEmail: ReturnType<typeof createVerifyEmail>;
}

/** Páginas que abren los enlaces de los correos (FR-037). El token nunca se registra en logs. */
export function linkRoutes(deps: LinkRoutesDeps) {
  const app = new Hono<AppEnv>();

  // El GET no consume el token: los escáneres de correo abren los enlaces solos.
  app.get(VERIFY_EMAIL_PATH, async (c) => {
    const token = c.req.query('token') ?? '';
    if ((await deps.checkVerificationLink(token)) === 'invalid') {
      return c.html(<InvalidVerificationLinkPage />);
    }
    return c.html(<ConfirmEmailPage token={token} action={VERIFY_EMAIL_PATH} />);
  });

  app.post(VERIFY_EMAIL_PATH, async (c) => {
    const form = await c.req.parseBody();
    const token = typeof form.token === 'string' ? form.token : '';
    const result = await deps.verifyEmail(token);
    return c.html(result === 'verified' ? <EmailVerifiedPage /> : <InvalidVerificationLinkPage />);
  });

  return app;
}
