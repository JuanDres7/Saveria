import createClient from 'openapi-fetch';
import type { paths } from './schema';

export type SessionLostReason = 'expired' | 'account_deleted';

export interface ApiClientDeps {
  baseUrl: string;
  /** Reemplazable en pruebas */
  fetchImpl?: typeof fetch;
  getAccessToken(): string | null;
  getRefreshToken(): Promise<string | null>;
  /** Debe persistir el refresh token nuevo ANTES de devolver (el anterior deja de servir). */
  onTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void> | void;
  onSessionLost(reason: SessionLostReason): Promise<void> | void;
}

/** Endpoints que no llevan access token ni se reintentan tras un 401. */
const PUBLIC_PATHS = [
  '/v1/auth/login',
  '/v1/auth/register',
  '/v1/auth/refresh',
  '/v1/auth/password/forgot',
  '/v1/legal/privacy-policy',
];

function isPublic(request: Request): boolean {
  const { pathname } = new URL(request.url);
  return PUBLIC_PATHS.some((path) => pathname.endsWith(path));
}

/**
 * Cliente tipado desde el contrato (`schema.d.ts`). Ante un 401 renueva la sesión y reintenta la
 * petición una vez.
 *
 * Solo hay UN refresh en vuelo (*single-flight*): si varias peticiones reciben 401 a la vez, todas
 * esperan el mismo refresh. Dos refresh en paralelo harían que el segundo presentara un token ya
 * rotado, y el servidor lo tomaría por un robo y cerraría la sesión del usuario legítimo.
 */
export function createApiClient(deps: ApiClientDeps) {
  const baseFetch: typeof fetch = deps.fetchImpl ?? ((...args) => fetch(...args));

  function withBearer(request: Request): Request {
    const token = deps.getAccessToken();
    if (!token || isPublic(request)) return request;
    const headers = new Headers(request.headers);
    headers.set('authorization', `Bearer ${token}`);
    return new Request(request, { headers });
  }

  async function isWrongPassword(response: Response): Promise<boolean> {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { code?: string } | null;
    return body?.code === 'invalid_credentials';
  }

  let inflight: Promise<boolean> | null = null;

  /** `true` si hay tokens nuevos. Un fallo de red NO cierra la sesión: el usuario sigue dentro. */
  async function doRefresh(): Promise<boolean> {
    const refreshToken = await deps.getRefreshToken();
    if (!refreshToken) {
      await deps.onSessionLost('expired');
      return false;
    }

    let response: Response;
    try {
      response = await baseFetch(
        new Request(`${deps.baseUrl}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        }),
      );
    } catch {
      return false;
    }

    if (response.ok) {
      const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
      await deps.onTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      return true;
    }
    if (response.status === 401) {
      const body = (await response.json().catch(() => null)) as { code?: string } | null;
      await deps.onSessionLost(body?.code === 'account_deleted' ? 'account_deleted' : 'expired');
    }
    // Otros estados (5xx, 429…) son pasajeros: no se pierde la sesión.
    return false;
  }

  function refreshSession(): Promise<boolean> {
    inflight ??= doRefresh().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  async function authFetch(request: Request): Promise<Response> {
    // Se clona antes de enviar: el cuerpo solo se puede leer una vez y puede hacer falta reintentar.
    const retry = request.clone();
    const response = await baseFetch(withBearer(request));
    if (response.status !== 401 || isPublic(request)) return response;
    // Una contraseña actual incorrecta (cambiar contraseña, borrar cuenta) también es 401, pero la
    // sesión está bien: renovarla y reintentar contaría el error dos veces para el límite.
    if (await isWrongPassword(response)) return response;

    if (!(await refreshSession())) return response;
    return baseFetch(withBearer(retry));
  }

  const client = createClient<paths>({ baseUrl: deps.baseUrl, fetch: authFetch });
  // `fetch` sirve para peticiones armadas fuera del contrato tipado (por ejemplo, el outbox).
  return { client, refreshSession, fetch: authFetch };
}

export type ApiClient = ReturnType<typeof createApiClient>['client'];
