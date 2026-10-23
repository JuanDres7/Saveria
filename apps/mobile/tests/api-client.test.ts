import { createApiClient, type SessionLostReason } from '../src/api/client';

const BASE = 'http://api.test';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Servidor falso: /v1/me solo acepta el access token vigente y /v1/auth/refresh rota los tokens. */
function setup(options: { refresh?: () => Response | Promise<Response> | never } = {}) {
  const state = { accessToken: 'old', refreshToken: 'r1', validAccess: 'new' };
  const calls = { refresh: 0, me: 0, auth: [] as (string | null)[] };
  const lost: SessionLostReason[] = [];

  const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as Request, init);
    const { pathname } = new URL(request.url);

    if (pathname === '/v1/auth/refresh') {
      calls.refresh += 1;
      if (options.refresh) return options.refresh();
      await new Promise((resolve) => setTimeout(resolve, 20)); // da tiempo a que lleguen más 401
      return json(200, { accessToken: 'new', refreshToken: 'r2', accessTokenExpiresAt: 'x' });
    }
    if (pathname === '/v1/me') {
      calls.me += 1;
      calls.auth.push(request.headers.get('authorization'));
      return request.headers.get('authorization') === `Bearer ${state.validAccess}`
        ? json(200, { ok: true })
        : json(401, { code: 'unauthorized', message: 'x' });
    }
    if (pathname === '/v1/auth/login') {
      calls.auth.push(request.headers.get('authorization'));
      return json(401, { code: 'invalid_credentials', message: 'x' });
    }
    return json(404, { code: 'not_found', message: 'x' });
  });

  const persisted = { refreshToken: state.refreshToken as string | null };
  const { client } = createApiClient({
    baseUrl: BASE,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    getAccessToken: () => state.accessToken,
    getRefreshToken: async () => persisted.refreshToken,
    onTokens: ({ accessToken, refreshToken }) => {
      state.accessToken = accessToken;
      persisted.refreshToken = refreshToken;
    },
    onSessionLost: (reason) => {
      lost.push(reason);
    },
  });
  return { client, state, calls, lost, persisted, fetchImpl };
}

describe('createApiClient', () => {
  it('agrega el access token a las peticiones', async () => {
    const t = setup();
    t.state.accessToken = 'new';
    const { response } = await t.client.GET('/v1/me');
    expect(response.status).toBe(200);
    expect(t.calls.auth).toEqual(['Bearer new']);
    expect(t.calls.refresh).toBe(0);
  });

  it('ante un 401 renueva la sesión y reintenta la petición con el token nuevo', async () => {
    const t = setup();
    const { response } = await t.client.GET('/v1/me');
    expect(response.status).toBe(200);
    expect(t.calls.refresh).toBe(1);
    expect(t.calls.auth).toEqual(['Bearer old', 'Bearer new']);
    expect(t.persisted.refreshToken).toBe('r2');
  });

  it('dos o más 401 simultáneos hacen UN solo refresh (single-flight)', async () => {
    const t = setup();
    const responses = await Promise.all([
      t.client.GET('/v1/me'),
      t.client.GET('/v1/me'),
      t.client.GET('/v1/me'),
    ]);
    expect(responses.map((r) => r.response.status)).toEqual([200, 200, 200]);
    expect(t.calls.refresh).toBe(1);
  });

  it('después de un refresh terminado, un nuevo 401 puede disparar otro refresh', async () => {
    const t = setup();
    await t.client.GET('/v1/me');
    t.state.validAccess = 'newer';
    t.state.accessToken = 'new';
    await t.client.GET('/v1/me').catch(() => {});
    expect(t.calls.refresh).toBe(2);
  });

  it('si el refresh responde account_deleted avisa que la cuenta ya no existe', async () => {
    const t = setup({ refresh: () => json(401, { code: 'account_deleted', message: 'x' }) });
    const { response } = await t.client.GET('/v1/me');
    expect(response.status).toBe(401);
    expect(t.lost).toEqual(['account_deleted']);
  });

  it('si el refresh responde otro 401, la sesión venció', async () => {
    const t = setup({ refresh: () => json(401, { code: 'unauthorized', message: 'x' }) });
    await t.client.GET('/v1/me');
    expect(t.lost).toEqual(['expired']);
  });

  it('sin refresh token guardado, la sesión venció', async () => {
    const t = setup();
    t.persisted.refreshToken = null;
    const { response } = await t.client.GET('/v1/me');
    expect(response.status).toBe(401);
    expect(t.lost).toEqual(['expired']);
    expect(t.calls.refresh).toBe(0);
  });

  it('un fallo de red durante el refresh NO cierra la sesión', async () => {
    const t = setup({
      refresh: () => {
        throw new TypeError('Network request failed');
      },
    });
    const { response } = await t.client.GET('/v1/me');
    expect(response.status).toBe(401);
    expect(t.lost).toEqual([]);
  });

  it('un 5xx durante el refresh NO cierra la sesión', async () => {
    const t = setup({ refresh: () => json(503, { code: 'internal_error', message: 'x' }) });
    await t.client.GET('/v1/me');
    expect(t.lost).toEqual([]);
  });

  it('un 401 en un endpoint público (login) no dispara refresh ni lleva el token', async () => {
    const t = setup();
    const { response } = await t.client.POST('/v1/auth/login', {
      body: {
        email: 'ana@mail.com',
        password: 'clave1234',
        device: { id: '0199a1b2-0000-7000-8000-000000000009' },
      },
    });
    expect(response.status).toBe(401);
    expect(t.calls.refresh).toBe(0);
    expect(t.calls.auth).toEqual([null]);
  });

  it('reintenta conservando el cuerpo de la petición original', async () => {
    const t = setup();
    // /v1/auth/password/change es un POST con cuerpo y requiere sesión
    const seen: string[] = [];
    t.fetchImpl.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input as Request, init);
      const { pathname } = new URL(request.url);
      if (pathname === '/v1/auth/refresh') {
        return json(200, { accessToken: 'new', refreshToken: 'r2', accessTokenExpiresAt: 'x' });
      }
      seen.push(await request.text());
      return request.headers.get('authorization') === 'Bearer new'
        ? new Response(null, { status: 204 })
        : json(401, { code: 'unauthorized', message: 'x' });
    });
    const { response } = await t.client.POST('/v1/auth/password/change', {
      body: { currentPassword: 'vieja1234', newPassword: 'nueva1234' },
    });
    expect(response.status).toBe(204);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
    expect(JSON.parse(seen[1] ?? '{}')).toEqual({
      currentPassword: 'vieja1234',
      newPassword: 'nueva1234',
    });
  });
});
