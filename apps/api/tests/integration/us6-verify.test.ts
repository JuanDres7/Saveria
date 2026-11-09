import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  type AuthJson,
  bearer,
  loginBody,
  postJson,
  putJson,
  registerUser,
} from '../support/auth-http';
import { jsonBody } from '../support/http';
import { createTestApp, type TestApp } from '../support/test-app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(() => t.reset());
afterAll(() => t.close());

const LINK = '/links/verify-email';
const DAY = 24 * 60 * 60 * 1000;

const openLink = (token: string) => t.app.request(`${LINK}?token=${encodeURIComponent(token)}`);
const confirmLink = (token: string) =>
  t.app.request(LINK, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }).toString(),
  });

type MeJson = AuthJson['me'] & {
  emailVerified: boolean;
  verificationRequired: boolean;
  verificationDeadline: string;
};
const getMe = async (token: string) =>
  jsonBody<MeJson>(await t.app.request('/v1/me', { headers: bearer(token) }));

async function loginAgain(): Promise<string> {
  const res = await postJson(t, '/v1/auth/login', loginBody());
  return (await jsonBody<AuthJson>(res)).tokens.accessToken;
}

async function registered() {
  const { tokens, me } = await registerUser(t);
  const link = t.emails.lastTokenTo('ana@mail.com');
  if (!link) throw new Error('no llegó el correo de verificación');
  return { accessToken: tokens.accessToken, userId: me.id, link };
}

describe('historia 6: verificar el correo', () => {
  it('6.1 al registrarse llega un correo con el enlace a la página de verificación', async () => {
    await registerUser(t);
    const [mail] = t.emails.to('ana@mail.com');
    expect(mail?.html).toContain('http://localhost:8000/links/verify-email?token=');
  });

  it('el GET no consume el token: abrirlo dos veces sigue mostrando el botón', async () => {
    const { link, accessToken } = await registered();
    for (let i = 0; i < 2; i += 1) {
      const html = await (await openLink(link)).text();
      expect(html).toContain('Confirmar mi correo');
      expect(html).toContain(`value="${link}"`);
    }
    expect((await getMe(accessToken)).emailVerified).toBe(false);
  });

  it('6.2 el POST verifica el correo y la app lo ve en GET /v1/me', async () => {
    const { link, accessToken } = await registered();
    const res = await confirmLink(link);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('ya puedes volver a la app');
    expect((await getMe(accessToken)).emailVerified).toBe(true);

    // usarlo otra vez dice que no es válido y ofrece pedir otro
    const again = await (await confirmLink(link)).text();
    expect(again).toContain('no es válido');
    expect(again).toContain('reenviar');
    expect(await (await openLink(link)).text()).toContain('no es válido');
  });

  it('6.3 reenviar invalida el enlace anterior', async () => {
    const { link: first, accessToken } = await registered();
    const res = await postJson(t, '/v1/auth/email/verification', {}, bearer(accessToken));
    expect(res.status).toBe(202);
    const second = t.emails.lastTokenTo('ana@mail.com') as string;
    expect(second).not.toBe(first);

    expect(await (await confirmLink(first)).text()).toContain('no es válido');
    expect(await (await confirmLink(second)).text()).toContain('ya puedes volver a la app');
  });

  it('reenviar responde igual aunque se pase el límite de 3 correos por hora', async () => {
    const { accessToken } = await registered();
    const bodies: unknown[] = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await postJson(t, '/v1/auth/email/verification', {}, bearer(accessToken));
      expect(res.status).toBe(202);
      bodies.push(await jsonBody(res));
    }
    // registro + 2 reenvíos = 3; los otros 2 no se envían
    expect(t.emails.to('ana@mail.com')).toHaveLength(3);
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
  });

  it('corregir el correo envía un enlace al nuevo y el viejo deja de servir', async () => {
    const { link: old, accessToken } = await registered();
    const res = await putJson(
      t,
      '/v1/auth/email',
      { email: 'Ana.Nueva@Mail.com' },
      bearer(accessToken),
    );
    expect(res.status).toBe(202);
    expect((await jsonBody<{ email: string }>(res)).email).toBe('ana.nueva@mail.com');

    expect(await (await confirmLink(old)).text()).toContain('no es válido');
    const fresh = t.emails.lastTokenTo('ana.nueva@mail.com') as string;
    expect(await (await confirmLink(fresh)).text()).toContain('ya puedes volver a la app');
  });

  it('con el correo ya verificado no se puede cambiar (409)', async () => {
    const { link, accessToken } = await registered();
    await confirmLink(link);
    const res = await putJson(t, '/v1/auth/email', { email: 'otro@mail.com' }, bearer(accessToken));
    expect(res.status).toBe(409);
    expect((await jsonBody(res)).code).toBe('email_already_verified');
  });

  it('6.4 verificationRequired pasa a true después de 7 días sin verificar', async () => {
    const { accessToken } = await registered();
    expect((await getMe(accessToken)).verificationRequired).toBe(false);

    // el access token vence a los 15 min: tras avanzar el reloj se entra de nuevo
    t.clock.advance(7 * DAY - 1000);
    expect((await getMe(await loginAgain())).verificationRequired).toBe(false);

    t.clock.advance(2000);
    expect((await getMe(await loginAgain())).verificationRequired).toBe(true);
  });

  it('verificar después de los 7 días quita el bloqueo, sin perder datos', async () => {
    const { accessToken } = await registered();
    await putJson(
      t,
      '/v1/me/profile',
      {
        aiName: null,
        countryCode: 'CO',
        city: 'Barranquilla',
        primaryCurrency: null,
        referenceCurrencies: [],
        aiMode: 'manual',
        onboardingStep: 'city',
        updatedAt: '2026-10-22T12:00:01.000Z',
      },
      bearer(accessToken),
    );
    t.clock.advance(8 * DAY);
    // el enlace del registro venció (24 h): se pide otro
    const fresh = await loginAgain();
    await postJson(t, '/v1/auth/email/verification', {}, bearer(fresh));
    await confirmLink(t.emails.lastTokenTo('ana@mail.com') as string);

    const me = (await getMe(fresh)) as MeJson & { profile: { city: string } };
    expect(me.verificationRequired).toBe(false);
    expect(me.profile.city).toBe('Barranquilla');
  });

  it('un enlace vencido (más de 24 h) muestra que no es válido', async () => {
    const { link } = await registered();
    t.clock.advance(DAY + 1000);
    expect(await (await openLink(link)).text()).toContain('no es válido');
    expect(await (await confirmLink(link)).text()).toContain('no es válido');
    expect((await getMe(await loginAgain())).emailVerified).toBe(false);
  });

  it('las páginas llevan los headers de seguridad', async () => {
    const { link } = await registered();
    for (const res of [await openLink(link), await confirmLink(link)]) {
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('content-security-policy')).toBe(
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
      );
      expect(res.headers.get('x-frame-options')).toBe('DENY');
    }
  });

  it('las páginas no cargan recursos externos', async () => {
    const { link } = await registered();
    const html = await (await openLink(link)).text();
    expect(html).not.toMatch(/<script|<link|<img|https?:\/\/(?!localhost)/i);
  });

  it('los logs no contienen el token', async () => {
    const { link } = await registered();
    t.logLines.length = 0;
    await openLink(link);
    await confirmLink(link);
    expect(t.logLines.length).toBeGreaterThan(0);
    expect(t.logLines.join('\n')).not.toContain(link);
  });
});
