import { Hono, type MiddlewareHandler } from 'hono';
import { RESET_PASSWORD_PATH } from '../../../application/use-cases/forgot-password';
import type {
  createCheckResetLink,
  createResetPassword,
} from '../../../application/use-cases/reset-password';
import { VERIFY_EMAIL_PATH } from '../../../application/use-cases/send-verification-email';
import type {
  createCheckVerificationLink,
  createVerifyEmail,
} from '../../../application/use-cases/verify-email';
import type { AppEnv } from '../context';
import {
  InvalidResetLinkPage,
  PasswordResetDonePage,
  ResetPasswordPage,
} from '../pages/reset-password';
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
  checkResetLink: ReturnType<typeof createCheckResetLink>;
  resetPassword: ReturnType<typeof createResetPassword>;
}

const formText = (value: unknown) => (typeof value === 'string' ? value : '');

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
    const result = await deps.verifyEmail(formText(form.token));
    return c.html(result === 'verified' ? <EmailVerifiedPage /> : <InvalidVerificationLinkPage />);
  });

  app.get(RESET_PASSWORD_PATH, async (c) => {
    const token = c.req.query('token') ?? '';
    if ((await deps.checkResetLink(token)) === 'invalid') return c.html(<InvalidResetLinkPage />);
    return c.html(<ResetPasswordPage token={token} action={RESET_PASSWORD_PATH} />);
  });

  app.post(RESET_PASSWORD_PATH, async (c) => {
    const form = await c.req.parseBody();
    const token = formText(form.token);
    const result = await deps.resetPassword({
      token,
      password: formText(form.password),
      passwordConfirmation: formText(form.passwordConfirmation),
    });
    if (result.status === 'done') return c.html(<PasswordResetDonePage />);
    if (result.status === 'invalid') return c.html(<InvalidResetLinkPage />);
    return c.html(
      <ResetPasswordPage token={token} action={RESET_PASSWORD_PATH} errors={result.errors} />,
    );
  });

  return app;
}
