import { PRIVACY_POLICY_VERSION } from '@saveria/shared';
import { jsonBody } from './http';
import type { TestApp } from './test-app';

export const TEST_DEVICE = { id: '0199a1b2-0000-7000-8000-00000000d001', name: 'Pixel 8' };
export const TEST_PASSWORD = 'clave1234';

export interface AuthJson {
  tokens: { accessToken: string; accessTokenExpiresAt: string; refreshToken: string };
  me: { id: string; email: string; profile: { onboardingStep: string } };
}

export function postJson(
  t: TestApp,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return t.app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export function registerBody(overrides: Record<string, unknown> = {}) {
  return {
    email: 'ana@mail.com',
    password: TEST_PASSWORD,
    policyVersion: PRIVACY_POLICY_VERSION,
    policyAccepted: true,
    device: TEST_DEVICE,
    ...overrides,
  };
}

/** Registra un usuario por HTTP y devuelve la respuesta ya leída. */
export async function registerUser(t: TestApp, overrides: Record<string, unknown> = {}) {
  const res = await postJson(t, '/v1/auth/register', registerBody(overrides));
  if (res.status !== 201) throw new Error(`registro falló con ${res.status}`);
  return jsonBody<AuthJson>(res);
}

export function loginBody(overrides: Record<string, unknown> = {}) {
  return { email: 'ana@mail.com', password: TEST_PASSWORD, device: TEST_DEVICE, ...overrides };
}

export function putJson(t: TestApp, path: string, body: unknown, headers: Record<string, string>) {
  return t.app.request(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

/** Perfil completo para `PUT /v1/me/profile`, con un `updatedAt` posterior al del registro. */
export function profileBody(overrides: Record<string, unknown> = {}) {
  return {
    aiName: null,
    countryCode: null,
    city: null,
    primaryCurrency: null,
    referenceCurrencies: [],
    aiMode: 'manual',
    onboardingStep: 'country',
    updatedAt: '2026-10-22T12:00:01.000Z',
    ...overrides,
  };
}
