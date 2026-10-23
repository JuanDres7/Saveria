import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { PRIVACY_POLICY_VERSION } from '@saveria/shared';
import { bearer, loginBody, postJson, registerBody, registerUser } from '../support/auth-http';
import { expectMatchesContract } from '../support/contract';
import { jsonBody } from '../support/http';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(() => t.reset());
afterAll(() => t.close());

// bcrypt real (costo 12): varias verificaciones por prueba.
const SLOW = 30_000;

async function expectContract(res: Response, method: 'get' | 'post', path: string, status: number) {
  expect(res.status).toBe(status);
  const body = res.status === 204 ? undefined : await jsonBody<unknown>(res);
  expectMatchesContract(method, path, status, body);
  return body as Record<string, unknown> | undefined;
}

describe('contrato: POST /v1/auth/register', () => {
  it('201 con tokens y Me, sin exponer el hash', async () => {
    const res = await postJson(t, '/v1/auth/register', registerBody());
    const body = await expectContract(res, 'post', '/v1/auth/register', 201);
    expect(JSON.stringify(body)).not.toContain('$2b$');
    expect(JSON.stringify(body)).not.toContain('passwordHash');
  });

  it('400 con errores por campo si la contraseña no cumple las reglas', async () => {
    const res = await postJson(t, '/v1/auth/register', registerBody({ password: 'corta' }));
    const body = await expectContract(res, 'post', '/v1/auth/register', 400);
    expect(body?.code).toBe('validation_error');
    expect((body?.fields as Record<string, string> | undefined)?.password).toBeDefined();
  });

  it('400 si falta el dispositivo', async () => {
    const { device: _omit, ...rest } = registerBody();
    const res = await postJson(t, '/v1/auth/register', rest);
    await expectContract(res, 'post', '/v1/auth/register', 400);
  });

  it(
    '409 genérico con un correo ya registrado',
    async () => {
      await registerUser(t);
      const res = await postJson(t, '/v1/auth/register', registerBody({ email: ' ANA@mail.com' }));
      const body = await expectContract(res, 'post', '/v1/auth/register', 409);
      expect(body?.code).toBe('email_unavailable');
    },
    SLOW,
  );

  it.each([
    ['policyAccepted falso', { policyAccepted: false }],
    ['versión desconocida', { policyVersion: '1999-01-v0' }],
  ])('422 policy_not_accepted (%s)', async (_n, overrides) => {
    const res = await postJson(t, '/v1/auth/register', registerBody(overrides));
    const body = await expectContract(res, 'post', '/v1/auth/register', 422);
    expect(body?.code).toBe('policy_not_accepted');
  });
});

describe('contrato: POST /v1/auth/login', () => {
  it(
    '200 con tokens y Me',
    async () => {
      await registerUser(t);
      const res = await postJson(t, '/v1/auth/login', loginBody());
      await expectContract(res, 'post', '/v1/auth/login', 200);
    },
    SLOW,
  );

  it(
    '401 invalid_credentials con una contraseña corta y mala (no 400)',
    async () => {
      await registerUser(t);
      const res = await postJson(t, '/v1/auth/login', loginBody({ password: 'x' }));
      const body = await expectContract(res, 'post', '/v1/auth/login', 401);
      expect(body?.code).toBe('invalid_credentials');
    },
    SLOW,
  );

  it('400 si el cuerpo está mal formado', async () => {
    const res = await postJson(t, '/v1/auth/login', { email: 'ana@mail.com' });
    await expectContract(res, 'post', '/v1/auth/login', 400);
  });

  it(
    '429 con Retry-After tras 5 fallos',
    async () => {
      await registerUser(t);
      for (let i = 0; i < 5; i += 1) {
        expect(
          (await postJson(t, '/v1/auth/login', loginBody({ password: 'mala1234' }))).status,
        ).toBe(401);
      }
      const res = await postJson(t, '/v1/auth/login', loginBody());
      const retryAfter = Number(res.headers.get('retry-after'));
      const body = await expectContract(res, 'post', '/v1/auth/login', 429);
      expect(body?.code).toBe('too_many_attempts');
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(15 * 60);
    },
    SLOW,
  );
});

describe('contrato: POST /v1/auth/refresh', () => {
  it('200 con un par nuevo', async () => {
    const { tokens } = await registerUser(t);
    const res = await postJson(t, '/v1/auth/refresh', { refreshToken: tokens.refreshToken });
    await expectContract(res, 'post', '/v1/auth/refresh', 200);
  });

  it.each([
    ['token inventado', { refreshToken: 'x'.repeat(40) }],
    ['token demasiado corto', { refreshToken: 'abc' }],
    ['sin token', {}],
  ])('401 (%s)', async (_n, body) => {
    const res = await postJson(t, '/v1/auth/refresh', body);
    await expectContract(res, 'post', '/v1/auth/refresh', 401);
  });

  it('401 con un cuerpo que no es JSON', async () => {
    const res = await t.app.request('/v1/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{no es json',
    });
    await expectContract(res, 'post', '/v1/auth/refresh', 401);
  });
});

describe('contrato: POST /v1/auth/logout', () => {
  it('204 con access token', async () => {
    const { tokens } = await registerUser(t);
    const res = await t.app.request('/v1/auth/logout', {
      method: 'POST',
      headers: bearer(tokens.accessToken),
    });
    await expectContract(res, 'post', '/v1/auth/logout', 204);
  });

  it('204 solo con refreshToken', async () => {
    const { tokens } = await registerUser(t);
    const res = await postJson(t, '/v1/auth/logout', { refreshToken: tokens.refreshToken });
    await expectContract(res, 'post', '/v1/auth/logout', 204);
  });

  it('204 con tokens inválidos o sin nada', async () => {
    await expectContract(
      await postJson(t, '/v1/auth/logout', { refreshToken: 'y'.repeat(40) }, bearer('basura')),
      'post',
      '/v1/auth/logout',
      204,
    );
    await expectContract(
      await t.app.request('/v1/auth/logout', { method: 'POST' }),
      'post',
      '/v1/auth/logout',
      204,
    );
  });
});

describe('contrato: GET /v1/me', () => {
  it('200 con el usuario recién registrado', async () => {
    const { tokens } = await registerUser(t);
    const res = await t.app.request('/v1/me', { headers: bearer(tokens.accessToken) });
    const body = await expectContract(res, 'get', '/v1/me', 200);
    expect(JSON.stringify(body)).not.toContain('$2b$');
  });

  it('401 sin token', async () => {
    await expectContract(await t.app.request('/v1/me'), 'get', '/v1/me', 401);
  });
});

describe('contrato: GET /v1/legal/privacy-policy', () => {
  it('200 con la versión vigente y la URL absoluta de la página', async () => {
    const res = await t.app.request('/v1/legal/privacy-policy');
    const body = await expectContract(res, 'get', '/v1/legal/privacy-policy', 200);
    expect(body?.version).toBe(PRIVACY_POLICY_VERSION);
    expect(body?.url).toBe('http://localhost:8000/legal/privacy');
  });

  it('la página /legal/privacy es HTML y cubre lo que pide FR-005', async () => {
    const res = await t.app.request('/legal/privacy');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain(PRIVACY_POLICY_VERSION);
    for (const topic of ['país', 'ciudad', 'inteligencia artificial', 'borrar']) {
      expect(html.toLowerCase()).toContain(topic);
    }
  });
});
