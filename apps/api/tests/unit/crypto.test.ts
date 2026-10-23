import { describe, expect, it } from 'bun:test';
import { SignJWT } from 'jose';
import { BunPasswordHasher } from '../../src/infrastructure/crypto/bun-password-hasher';
import { JoseTokenService } from '../../src/infrastructure/crypto/jose-token-service';
import { CryptoRandom } from '../../src/infrastructure/crypto/random';
import { FakeClock } from '../support/fake-clock';

const SECRET = 'x'.repeat(40);
const USER_ID = '0199a1b2-0000-7000-8000-000000000001';
const SESSION_ID = '0199a1b2-0000-7000-8000-000000000002';

describe('BunPasswordHasher', () => {
  const hasher = new BunPasswordHasher();

  it('genera un hash bcrypt que no contiene la contraseña y se puede verificar', async () => {
    const hash = await hasher.hash('clave1234');
    expect(hash.startsWith('$2')).toBe(true);
    expect(hash).not.toContain('clave1234');
    expect(await hasher.verify('clave1234', hash)).toBe(true);
    expect(await hasher.verify('clave12345', hash)).toBe(false);
  });

  it('dos hashes de la misma contraseña son distintos (sal)', async () => {
    expect(await hasher.hash('clave1234')).not.toBe(await hasher.hash('clave1234'));
  });

  it('distingue contraseñas largas que solo difieren después del byte 72', async () => {
    const base = 'a1'.repeat(40);
    const hash = await hasher.hash(`${base}X`);
    expect(await hasher.verify(`${base}X`, hash)).toBe(true);
    expect(await hasher.verify(`${base}Y`, hash)).toBe(false);
  });

  it('un hash con formato inválido nunca verifica', async () => {
    expect(await hasher.verify('clave1234', 'no-es-un-hash')).toBe(false);
  });

  it('verifyDummy termina sin error', async () => {
    await expect(hasher.verifyDummy('cualquier cosa')).resolves.toBeUndefined();
  });
});

describe('JoseTokenService', () => {
  it('firma un token que se verifica con sus claims', async () => {
    const service = new JoseTokenService(SECRET, new FakeClock());
    const { token } = await service.signAccess({ sub: USER_ID, sid: SESSION_ID });
    expect(await service.verifyAccess(token)).toEqual({ sub: USER_ID, sid: SESSION_ID });
  });

  it('vence a los 15 minutos', async () => {
    const clock = new FakeClock();
    const service = new JoseTokenService(SECRET, clock);
    const { token, expiresAt } = await service.signAccess({ sub: USER_ID, sid: SESSION_ID });
    expect(expiresAt.getTime() - clock.now().getTime()).toBe(15 * 60 * 1000);

    clock.advance(14 * 60 * 1000 + 59 * 1000);
    expect(await service.verifyAccess(token)).not.toBeNull();
    clock.advance(2 * 1000);
    expect(await service.verifyAccess(token)).toBeNull();
  });

  it('rechaza un token manipulado', async () => {
    const service = new JoseTokenService(SECRET, new FakeClock());
    const { token } = await service.signAccess({ sub: USER_ID, sid: SESSION_ID });
    const [header, payload, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload ?? '', 'base64url').toString()),
        sub: 'otro',
      }),
    ).toString('base64url');
    expect(await service.verifyAccess(`${header}.${forged}.${signature}`)).toBeNull();
    expect(await service.verifyAccess(`${token}x`)).toBeNull();
    expect(await service.verifyAccess('basura')).toBeNull();
  });

  it('rechaza un token firmado con otro secreto', async () => {
    const clock = new FakeClock();
    const { token } = await new JoseTokenService('y'.repeat(40), clock).signAccess({
      sub: USER_ID,
      sid: SESSION_ID,
    });
    expect(await new JoseTokenService(SECRET, clock).verifyAccess(token)).toBeNull();
  });

  it('rechaza un token con otro algoritmo', async () => {
    const key = new TextEncoder().encode(SECRET);
    const token = await new SignJWT({ sid: SESSION_ID })
      .setProtectedHeader({ alg: 'HS512' })
      .setSubject(USER_ID)
      .setExpirationTime('15m')
      .sign(key);
    expect(await new JoseTokenService(SECRET, new FakeClock()).verifyAccess(token)).toBeNull();
  });

  it('rechaza un token sin el claim sid', async () => {
    const key = new TextEncoder().encode(SECRET);
    const clock = new FakeClock();
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setExpirationTime(Math.floor(clock.now().getTime() / 1000) + 600)
      .sign(key);
    expect(await new JoseTokenService(SECRET, clock).verifyAccess(token)).toBeNull();
  });
});

describe('CryptoRandom', () => {
  const random = new CryptoRandom();

  it('token devuelve base64url del largo esperado y distinto cada vez', () => {
    const a = random.token(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(random.token(32)).not.toBe(a);
  });

  it('uuidV7 devuelve un UUID versión 7 y se ordena por tiempo', async () => {
    const first = random.uuidV7();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await Bun.sleep(2);
    expect(random.uuidV7() > first).toBe(true);
  });

  it('sha256Hex coincide con el vector de prueba conocido', () => {
    expect(random.sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
