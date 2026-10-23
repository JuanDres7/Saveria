import { describe, expect, it } from 'bun:test';
import { createLogger } from '../../src/infrastructure/logging/logger';

function capture() {
  const lines: string[] = [];
  const destination = { write: (line: string) => void lines.push(line) };
  return { lines, logger: createLogger('info', destination) };
}

describe('logger', () => {
  it('oculta contraseñas, tokens, correos y cabeceras de autorización', () => {
    const { lines, logger } = capture();
    logger.info(
      {
        password: 'clave1234',
        currentPassword: 'vieja1234',
        newPassword: 'nueva1234',
        token: 'tok-secreto',
        refreshToken: 'refresh-secreto',
        email: 'ana@mail.com',
        authorization: 'Bearer jwt-secreto',
        body: { password: 'anidada1234', token: 'tok-anidado', email: 'otra@mail.com' },
        req: { headers: { authorization: 'Bearer otro-jwt' } },
      },
      'prueba',
    );
    const output = lines.join('');
    for (const secret of [
      'clave1234',
      'vieja1234',
      'nueva1234',
      'tok-secreto',
      'refresh-secreto',
      'ana@mail.com',
      'jwt-secreto',
      'anidada1234',
      'tok-anidado',
      'otra@mail.com',
      'otro-jwt',
    ]) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain('[REDACTED]');
    expect(output).toContain('prueba');
  });

  it('conserva los campos que no son secretos', () => {
    const { lines, logger } = capture();
    logger.info({ method: 'POST', path: '/v1/auth/login', status: 200 }, 'request');
    const entry = JSON.parse(lines[0] ?? '{}');
    expect(entry).toMatchObject({ method: 'POST', path: '/v1/auth/login', status: 200 });
  });
});
