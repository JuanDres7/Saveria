import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { postJson } from '../support/auth-http';
import { expectMatchesContract } from '../support/contract';
import { jsonBody } from '../support/http';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(() => t.reset());
afterAll(() => t.close());

const FORGOT = '/v1/auth/password/forgot';
const LINK = '/links/reset-password';

describe('contrato: POST /v1/auth/password/forgot', () => {
  it('202 con el mensaje neutral', async () => {
    const res = await postJson(t, FORGOT, { email: 'nadie@mail.com' });
    expect(res.status).toBe(202);
    expectMatchesContract('post', FORGOT, 202, await jsonBody(res));
  });

  it('400 con un correo inválido', async () => {
    const res = await postJson(t, FORGOT, { email: 'no-es-correo' });
    expect(res.status).toBe(400);
    expectMatchesContract('post', FORGOT, 400, await jsonBody(res));
  });
});

describe('contrato: /links/reset-password', () => {
  it('GET 200 text/html', async () => {
    const res = await t.app.request(`${LINK}?token=cualquiera`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expectMatchesContract('get', LINK, 200, undefined);
  });

  it('POST 200 text/html', async () => {
    const res = await t.app.request(LINK, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: 'cualquiera',
        password: 'nueva5678',
        passwordConfirmation: 'nueva5678',
      }).toString(),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expectMatchesContract('post', LINK, 200, undefined);
  });
});
