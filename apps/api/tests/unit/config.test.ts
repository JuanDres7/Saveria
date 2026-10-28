import { describe, expect, it } from 'bun:test';
import { loadConfig } from '../../src/config';

const validEnv = {
  DATABASE_URL: 'postgres://saveria:saveria@localhost:5432/saveria',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
  PUBLIC_BASE_URL: 'http://localhost:8000',
  EMAIL_FROM: 'Saveria <no-reply@example.com>',
};

describe('loadConfig', () => {
  it('aplica los valores por defecto', () => {
    const config = loadConfig(validEnv);
    expect(config.PORT).toBe(8000);
    expect(config.EMAIL_PROVIDER).toBe('dev-outbox');
    expect(config.TRUSTED_PROXY_HOPS).toBe(0);
    expect(config.NODE_ENV).toBe('development');
  });

  it('convierte PORT y TRUSTED_PROXY_HOPS a número', () => {
    const config = loadConfig({ ...validEnv, PORT: '9000', TRUSTED_PROXY_HOPS: '2' });
    expect(config.PORT).toBe(9000);
    expect(config.TRUSTED_PROXY_HOPS).toBe(2);
  });

  it('falla si JWT_SECRET tiene menos de 32 bytes', () => {
    expect(() => loadConfig({ ...validEnv, JWT_SECRET: 'a'.repeat(31) })).toThrow('JWT_SECRET');
  });

  it('falla si falta una variable obligatoria', () => {
    const { DATABASE_URL: _omit, ...rest } = validEnv;
    expect(() => loadConfig(rest)).toThrow('DATABASE_URL');
  });

  it('exige RESEND_API_KEY cuando el proveedor es resend', () => {
    expect(() => loadConfig({ ...validEnv, EMAIL_PROVIDER: 'resend' })).toThrow('RESEND_API_KEY');
    expect(
      loadConfig({ ...validEnv, EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_test' })
        .EMAIL_PROVIDER,
    ).toBe('resend');
  });

  describe('en producción', () => {
    const prodEnv = {
      ...validEnv,
      NODE_ENV: 'production',
      PUBLIC_BASE_URL: 'https://api.saveria.app',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test',
    };

    it('acepta una configuración completa', () => {
      expect(loadConfig(prodEnv).NODE_ENV).toBe('production');
    });

    it('no permite dev-outbox: los enlaces quedarían en disco y nunca llegarían', () => {
      expect(() => loadConfig({ ...prodEnv, EMAIL_PROVIDER: 'dev-outbox' })).toThrow(
        'EMAIL_PROVIDER',
      );
      // tampoco por omisión
      const { EMAIL_PROVIDER: _omit, ...rest } = prodEnv;
      expect(() => loadConfig(rest)).toThrow('EMAIL_PROVIDER');
    });

    it('exige https en PUBLIC_BASE_URL: los enlaces de los correos llevan el token', () => {
      expect(() => loadConfig({ ...prodEnv, PUBLIC_BASE_URL: 'http://api.saveria.app' })).toThrow(
        'PUBLIC_BASE_URL',
      );
    });
  });

  it('fuera de producción se permiten dev-outbox y http', () => {
    const config = loadConfig({ ...validEnv, NODE_ENV: 'test' });
    expect(config.EMAIL_PROVIDER).toBe('dev-outbox');
    expect(config.PUBLIC_BASE_URL).toBe('http://localhost:8000');
  });

  it('el mensaje de error no incluye los valores de las variables', () => {
    const secret = 'corto-y-secreto';
    try {
      loadConfig({ ...validEnv, JWT_SECRET: secret });
      throw new Error('debía fallar');
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
