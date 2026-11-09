import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { bearer, postJson, registerUser } from '../support/auth-http';
import { expectMatchesContract } from '../support/contract';
import { jsonBody } from '../support/http';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;
let token: string;

beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(async () => {
  await t.reset();
  token = (await registerUser(t)).tokens.accessToken;
});
afterAll(() => t.close());

// bcrypt real (costo 12) en cada intento
const SLOW = 30_000;
const PATH = '/v1/auth/password/change';

const change = (body: unknown, headers: Record<string, string> = bearer(token)) =>
  postJson(t, PATH, body, headers);

async function expectContract(res: Response, status: number) {
  expect(res.status).toBe(status);
  const body = status === 204 ? undefined : await jsonBody<Record<string, unknown>>(res);
  expectMatchesContract('post', PATH, status, body);
  return body;
}

describe('contrato: POST /v1/auth/password/change', () => {
  it(
    '204 con la contraseña actual correcta',
    async () => {
      await expectContract(
        await change({ currentPassword: 'clave1234', newPassword: 'nueva5678' }),
        204,
      );
    },
    SLOW,
  );

  it('400 con una contraseña nueva que no cumple las reglas', async () => {
    const body = await expectContract(
      await change({ currentPassword: 'clave1234', newPassword: 'corta' }),
      400,
    );
    expect(body?.code).toBe('validation_error');
  });

  it(
    '401 invalid_credentials con la contraseña actual incorrecta',
    async () => {
      const body = await expectContract(
        await change({ currentPassword: 'mala1234', newPassword: 'nueva5678' }),
        401,
      );
      expect(body?.code).toBe('invalid_credentials');
    },
    SLOW,
  );

  it('401 unauthorized sin token', async () => {
    const body = await expectContract(
      await change({ currentPassword: 'clave1234', newPassword: 'nueva5678' }, {}),
      401,
    );
    expect(body?.code).toBe('unauthorized');
  });

  it(
    '429 con Retry-After tras 5 intentos fallidos',
    async () => {
      for (let i = 0; i < 5; i += 1) {
        await change({ currentPassword: 'mala1234', newPassword: 'nueva5678' });
      }
      const res = await change({ currentPassword: 'clave1234', newPassword: 'nueva5678' });
      expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
      const body = await expectContract(res, 429);
      expect(body?.code).toBe('too_many_attempts');
    },
    SLOW,
  );
});
