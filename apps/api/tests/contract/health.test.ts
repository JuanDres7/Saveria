import { describe, expect, it } from 'bun:test';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/config';
import { createLogger } from '../../src/infrastructure/logging/logger';
import { expectMatchesContract } from '../support/contract';
import { jsonBody } from '../support/http';

const config = loadConfig({
  DATABASE_URL: 'postgres://saveria:saveria@localhost:5432/saveria_test',
  REDIS_URL: 'redis://localhost:6379/1',
  JWT_SECRET: 'a'.repeat(40),
  PUBLIC_BASE_URL: 'http://localhost:8000',
  EMAIL_FROM: 'Saveria <pruebas@example.com>',
  NODE_ENV: 'test',
});
const app = createApp({ config, logger: createLogger('silent') });

describe('contrato: GET /health', () => {
  it('responde 200 con el cuerpo documentado', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expectMatchesContract('get', '/health', 200, await jsonBody<unknown>(res));
  });
});

describe('el validador de contrato', () => {
  it('rechaza un cuerpo que no cumple el esquema', () => {
    expect(() => expectMatchesContract('get', '/health', 200, { status: 'caído' })).toThrow(
      'no cumple el contrato',
    );
    expect(() => expectMatchesContract('get', '/health', 200, {})).toThrow('no cumple el contrato');
  });

  it('rechaza un estado que el contrato no documenta', () => {
    expect(() => expectMatchesContract('get', '/health', 500, {})).toThrow(
      'no documenta el estado',
    );
  });

  it('rechaza una operación que no existe en el contrato', () => {
    expect(() => expectMatchesContract('get', '/no-existe', 200, {})).toThrow('no existe');
  });

  it('valida errores que usan una respuesta compartida ($ref a components/responses)', () => {
    expectMatchesContract('post', '/v1/auth/login', 401, {
      code: 'invalid_credentials',
      message: 'Correo o contraseña incorrectos',
    });
    expect(() =>
      expectMatchesContract('post', '/v1/auth/login', 401, { code: 'inventado', message: 'x' }),
    ).toThrow('no cumple el contrato');
  });

  it('valida formatos como uuid, date-time y listas con restricciones', () => {
    const me = {
      id: '0199a1b2-0000-7000-8000-000000000001',
      email: 'ana@mail.com',
      emailVerified: false,
      verificationDeadline: '2026-10-29T12:00:00.000Z',
      verificationRequired: false,
      profile: {
        aiName: null,
        countryCode: null,
        city: null,
        primaryCurrency: null,
        referenceCurrencies: [],
        aiMode: 'manual',
        onboardingStep: 'ai_name',
        updatedAt: '2026-10-22T12:00:00.000Z',
      },
      defaultAccount: null,
    };
    expectMatchesContract('get', '/v1/me', 200, me);
    expect(() => expectMatchesContract('get', '/v1/me', 200, { ...me, id: 'no-es-uuid' })).toThrow(
      'no cumple el contrato',
    );
    expect(() =>
      expectMatchesContract('get', '/v1/me', 200, {
        ...me,
        profile: { ...me.profile, referenceCurrencies: ['USD', 'EUR', 'MXN'] },
      }),
    ).toThrow('no cumple el contrato');
  });

  it('una respuesta sin cuerpo (204) no admite cuerpo JSON', () => {
    expectMatchesContract('post', '/v1/auth/logout', 204, undefined);
    expect(() => expectMatchesContract('post', '/v1/auth/logout', 204, { a: 1 })).toThrow(
      'no debe llevar cuerpo',
    );
  });
});
