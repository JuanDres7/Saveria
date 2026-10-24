import { fileURLToPath } from 'node:url';
import { Scalar } from '@scalar/hono-api-reference';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { createChangeEmail } from './application/use-cases/change-email';
import { createChangePassword } from './application/use-cases/change-password';
import { createCompleteOnboarding } from './application/use-cases/complete-onboarding';
import { createDeleteAccount } from './application/use-cases/delete-account';
import { createGetMe } from './application/use-cases/get-me';
import { createLogin } from './application/use-cases/login';
import { createLogout } from './application/use-cases/logout';
import { createRefresh } from './application/use-cases/refresh';
import { createRegister } from './application/use-cases/register';
import { createResendVerification } from './application/use-cases/resend-verification';
import { createUpdateProfile } from './application/use-cases/update-profile';
import {
  createCheckVerificationLink,
  createVerifyEmail,
} from './application/use-cases/verify-email';
import type { Container } from './container';
import type { AppEnv } from './interfaces/http/context';
import { requireAuth } from './interfaces/http/middleware/auth';
import { limitBodySize } from './interfaces/http/middleware/body-limit';
import { clientIp } from './interfaces/http/middleware/client-ip';
import { createErrorHandler, notFoundHandler } from './interfaces/http/middleware/error-handler';
import { requestLogger } from './interfaces/http/middleware/request-logger';
import { authRoutes } from './interfaces/http/routes/auth';
import { legalRoutes } from './interfaces/http/routes/legal';
import { linkPageHeaders, linkRoutes } from './interfaces/http/routes/links';
import { meRoutes } from './interfaces/http/routes/me';

/** Lo que `createApp` necesita del contenedor; las pruebas pueden pasar un subconjunto. */
export type AppDeps = Pick<Container, 'config' | 'logger'> & Partial<Container>;

/** Las rutas `/v1` necesitan el contenedor completo; `/health` y las páginas legales, no. */
function isFullContainer(deps: AppDeps): deps is Container {
  return deps.uow !== undefined && deps.repositories !== undefined;
}

function mountApi(app: Hono<AppEnv>, deps: Container) {
  const auth = requireAuth({
    tokens: deps.tokens,
    sessions: deps.repositories.sessions,
    clock: deps.clock,
  });
  app.route(
    '/v1/auth',
    authRoutes({
      register: createRegister(deps),
      login: createLogin(deps),
      refresh: createRefresh(deps),
      logout: createLogout(deps),
      changePassword: createChangePassword(deps),
      resendVerification: createResendVerification(deps),
      changeEmail: createChangeEmail(deps),
      auth,
    }),
  );
  app.route(
    '/v1/me',
    meRoutes({
      auth,
      getMe: createGetMe(deps),
      updateProfile: createUpdateProfile(deps),
      completeOnboarding: createCompleteOnboarding(deps),
      deleteAccount: createDeleteAccount(deps),
    }),
  );
  app.route(
    '/',
    linkRoutes({
      checkVerificationLink: createCheckVerificationLink(deps),
      verifyEmail: createVerifyEmail(deps),
    }),
  );
}

export interface AppOptions {
  /** Reemplaza la resolución de la IP del socket (solo para pruebas). */
  getSocketIp?: Parameters<typeof clientIp>[0]['getSocketIp'];
}

const OPENAPI_FILE = fileURLToPath(
  new URL('../../../specs/001-auth-onboarding/contracts/openapi.yaml', import.meta.url),
);

export function createApp(deps: AppDeps, options: AppOptions = {}) {
  const { config, logger } = deps;
  const app = new Hono<AppEnv>();

  app.onError(createErrorHandler(logger, config.NODE_ENV === 'production'));
  app.notFound(notFoundHandler);

  app.use(requestLogger(logger));
  // Antes de `secureHeaders`, para que sus headers más estrictos queden al final.
  app.use('/links/*', linkPageHeaders);
  app.use(secureHeaders());
  app.use(limitBodySize());
  app.use(
    clientIp({ trustedProxyHops: config.TRUSTED_PROXY_HOPS, getSocketIp: options.getSocketIp }),
  );

  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/', legalRoutes({ publicBaseUrl: config.PUBLIC_BASE_URL }));
  if (isFullContainer(deps)) mountApi(app, deps);

  // El contrato navegable solo existe fuera de producción.
  if (config.NODE_ENV !== 'production') {
    app.get('/docs/openapi.yaml', (c) =>
      c.body(Bun.file(OPENAPI_FILE).stream(), 200, { 'content-type': 'application/yaml' }),
    );
    app.get('/docs', Scalar({ url: '/docs/openapi.yaml' }));
  }

  return app;
}

export type App = ReturnType<typeof createApp>;
