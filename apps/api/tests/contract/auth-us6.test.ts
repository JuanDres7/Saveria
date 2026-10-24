import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { bearer, postJson, putJson, registerUser } from '../support/auth-http';
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

const RESEND = '/v1/auth/email/verification';
const CHANGE = '/v1/auth/email';
const LINK = '/links/verify-email';

describe('contrato: POST /v1/auth/email/verification', () => {
  it('202 con el mensaje neutral', async () => {
    const res = await postJson(t, RESEND, {}, bearer(token));
    expect(res.status).toBe(202);
    expectMatchesContract('post', RESEND, 202, await jsonBody(res));
  });

  it('401 sin token', async () => {
    const res = await postJson(t, RESEND, {});
    expect(res.status).toBe(401);
    expectMatchesContract('post', RESEND, 401, await jsonBody(res));
  });
});

describe('contrato: PUT /v1/auth/email', () => {
  it('202 con el usuario actualizado', async () => {
    const res = await putJson(t, CHANGE, { email: 'nuevo@mail.com' }, bearer(token));
    expect(res.status).toBe(202);
    const body = await jsonBody<{ email: string }>(res);
    expectMatchesContract('put', CHANGE, 202, body);
    expect(body.email).toBe('nuevo@mail.com');
  });

  it('400 con un correo inválido', async () => {
    const res = await putJson(t, CHANGE, { email: 'no-es-correo' }, bearer(token));
    expect(res.status).toBe(400);
    expectMatchesContract('put', CHANGE, 400, await jsonBody(res));
  });

  it('401 sin token', async () => {
    const res = await putJson(t, CHANGE, { email: 'nuevo@mail.com' }, {});
    expect(res.status).toBe(401);
    expectMatchesContract('put', CHANGE, 401, await jsonBody(res));
  });

  it('409 si el correo ya lo usa otra cuenta', async () => {
    await registerUser(t, { email: 'otra@mail.com' });
    const res = await putJson(t, CHANGE, { email: 'otra@mail.com' }, bearer(token));
    expect(res.status).toBe(409);
    expectMatchesContract('put', CHANGE, 409, await jsonBody(res));
  });
});

describe('contrato: /links/verify-email', () => {
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
      body: new URLSearchParams({ token: 'cualquiera' }).toString(),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expectMatchesContract('post', LINK, 200, undefined);
  });
});
