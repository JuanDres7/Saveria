import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { bearer, loginBody, postJson, registerUser } from '../support/auth-http';
import { jsonBody } from '../support/http';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(() => t.reset());
afterAll(() => t.close());

// bcrypt real (costo 12)
const SLOW = 30_000;
const LINK = '/links/reset-password';

const forgot = (email: string) => postJson(t, '/v1/auth/password/forgot', { email });
const openLink = (token: string) => t.app.request(`${LINK}?token=${encodeURIComponent(token)}`);
const submit = (token: string, password: string, passwordConfirmation = password) =>
  t.app.request(LINK, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token, password, passwordConfirmation }).toString(),
  });

/** Usuario registrado que pide recuperar su contraseña; devuelve el token del correo. */
async function requested() {
  const { tokens } = await registerUser(t);
  t.emails.sent.length = 0; // fuera el correo de verificación
  await forgot('ana@mail.com');
  const token = t.emails.lastTokenTo('ana@mail.com');
  if (!token) throw new Error('no llegó el correo de recuperación');
  return { token, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

describe('historia 5: recuperar la contraseña', () => {
  it('5.3 la respuesta es idéntica exista o no el correo', async () => {
    await registerUser(t);
    const existing = await forgot('ana@mail.com');
    const missing = await forgot('nadie@mail.com');
    expect(existing.status).toBe(202);
    expect(missing.status).toBe(202);
    expect(await jsonBody(existing)).toEqual(await jsonBody(missing));
  });

  it('5.3 la respuesta es la misma aunque se pase el límite de correos', async () => {
    await registerUser(t); // 1 correo de verificación
    const bodies = [];
    for (let i = 0; i < 4; i += 1) bodies.push(await jsonBody(await forgot('ana@mail.com')));
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
    // verificación + 2 de recuperación = 3
    expect(t.emails.to('ana@mail.com')).toHaveLength(3);
  });

  it(
    '5.4 con el enlace se crea la contraseña nueva, se puede entrar con ella y las sesiones se cierran',
    async () => {
      const { token, accessToken, refreshToken } = await requested();

      const page = await (await openLink(token)).text();
      expect(page).toContain('name="password"');
      expect(page).toContain('name="passwordConfirmation"');

      const done = await (await submit(token, 'nueva5678')).text();
      expect(done).toContain('Ya puedes entrar en la app con tu contraseña nueva');

      expect((await t.app.request('/v1/me', { headers: bearer(accessToken) })).status).toBe(401);
      expect((await postJson(t, '/v1/auth/refresh', { refreshToken })).status).toBe(401);
      expect((await postJson(t, '/v1/auth/login', loginBody())).status).toBe(401);
      expect(
        (await postJson(t, '/v1/auth/login', loginBody({ password: 'nueva5678' }))).status,
      ).toBe(200);
    },
    SLOW,
  );

  it('el GET no consume el token', async () => {
    const { token } = await requested();
    for (let i = 0; i < 2; i += 1) {
      expect(await (await openLink(token)).text()).toContain('name="password"');
    }
  });

  it(
    '5.5 el segundo uso dice que no es válido y ofrece pedir otro',
    async () => {
      const { token } = await requested();
      await submit(token, 'nueva5678');
      for (const html of [
        await (await openLink(token)).text(),
        await (await submit(token, 'otra9999')).text(),
      ]) {
        expect(html).toContain('no es válido');
        expect(html).toContain('Olvidé mi contraseña');
      }
    },
    SLOW,
  );

  it(
    'dos envíos simultáneos del mismo enlace: solo uno cambia la contraseña',
    async () => {
      const { token } = await requested();
      const send = async (password: string) => (await submit(token, password)).text();
      const pages = await Promise.all([send('primera1234'), send('segunda1234')]);
      const done = pages.filter((html) => html.includes('Ya puedes entrar en la app'));
      expect(done).toHaveLength(1);
      expect(pages.filter((html) => html.includes('no es válido'))).toHaveLength(1);

      const winner = pages[0]?.includes('Ya puedes entrar') ? 'primera1234' : 'segunda1234';
      expect((await postJson(t, '/v1/auth/login', loginBody({ password: winner }))).status).toBe(
        200,
      );
    },
    SLOW,
  );

  it('5.5 un enlace vencido (más de 30 min) no es válido', async () => {
    const { token } = await requested();
    t.clock.advance(30 * 60 * 1000 + 1000);
    expect(await (await openLink(token)).text()).toContain('no es válido');
  });

  it('con una contraseña inválida vuelve a mostrar el formulario con el error, sin gastar el enlace', async () => {
    const { token } = await requested();
    const html = await (await submit(token, 'corta')).text();
    expect(html).toContain('name="password"');
    expect(html).toContain('al menos 8 caracteres');
    expect(await (await openLink(token)).text()).toContain('name="password"');

    const mismatch = await (await submit(token, 'nueva5678', 'nueva0000')).text();
    expect(mismatch).toContain('Las contraseñas no coinciden');
  });

  it('las páginas llevan los headers de seguridad y no registran el token', async () => {
    const { token } = await requested();
    t.logLines.length = 0;
    for (const res of [await openLink(token), await submit(token, 'corta')]) {
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('content-security-policy')).toBe(
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
      );
      expect(res.headers.get('x-frame-options')).toBe('DENY');
    }
    expect(t.logLines.join('\n')).not.toContain(token);
    expect(t.logLines.join('\n')).not.toContain('corta');
  });
});
