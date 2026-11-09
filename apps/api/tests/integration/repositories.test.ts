import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { createRepositories, DrizzleUnitOfWork } from '../../src/infrastructure/db/repositories';
import {
  makeAccount,
  makeProfile,
  makeSession,
  makeToken,
  makeTransaction,
  makeUser,
  testId,
} from '../support/builders';
import { createTestDb, resetDatabase } from '../support/db';

const { db, client } = createTestDb();
const repos = createRepositories(db);
const at = new Date('2026-10-23T08:00:00.000Z');

beforeEach(() => resetDatabase(client));
afterAll(() => client.end());

describe('UserRepository', () => {
  it('crea y busca por id y por correo', async () => {
    const user = makeUser({ email: 'ana@mail.com' });
    expect(await repos.users.create(user)).toBe('created');
    expect(await repos.users.findById(user.id)).toMatchObject({ email: 'ana@mail.com' });
    expect((await repos.users.findByEmail('ana@mail.com'))?.id).toBe(user.id);
    expect(await repos.users.findByEmail('otra@mail.com')).toBeNull();
  });

  it('un correo repetido devuelve email_taken sin lanzar error', async () => {
    await repos.users.create(makeUser({ email: 'ana@mail.com' }));
    expect(await repos.users.create(makeUser({ email: 'ana@mail.com' }))).toBe('email_taken');
  });

  it('un correo repetido no aborta la transacción en curso', async () => {
    await repos.users.create(makeUser({ email: 'ana@mail.com' }));
    const uow = new DrizzleUnitOfWork(db);
    const result = await uow.run(async (tx) => {
      const outcome = await tx.users.create(makeUser({ email: 'ana@mail.com' }));
      // si la transacción estuviera abortada, esta consulta fallaría
      const found = await tx.users.findByEmail('ana@mail.com');
      return { outcome, found: found !== null };
    });
    expect(result).toEqual({ outcome: 'email_taken', found: true });
  });

  it('markEmailVerified y updatePasswordHash actualizan la fila', async () => {
    const user = makeUser();
    await repos.users.create(user);
    await repos.users.markEmailVerified(user.id, at);
    await repos.users.updatePasswordHash(user.id, 'nuevo-hash', at);
    expect(await repos.users.findById(user.id)).toMatchObject({
      emailVerifiedAt: at,
      passwordHash: 'nuevo-hash',
    });
  });

  it('updateEmail cambia el correo y lo deja sin verificar', async () => {
    const user = makeUser({ emailVerifiedAt: at });
    await repos.users.create(user);
    expect(await repos.users.updateEmail(user.id, 'nuevo@mail.com', at)).toBe('updated');
    expect(await repos.users.findById(user.id)).toMatchObject({
      email: 'nuevo@mail.com',
      emailVerifiedAt: null,
    });
  });

  it('updateEmail a un correo ya usado devuelve email_taken', async () => {
    await repos.users.create(makeUser({ email: 'ana@mail.com' }));
    const other = makeUser({ email: 'luis@mail.com' });
    await repos.users.create(other);
    expect(await repos.users.updateEmail(other.id, 'ana@mail.com', at)).toBe('email_taken');
    expect((await repos.users.findById(other.id))?.email).toBe('luis@mail.com');
  });

  it('delete borra en cascada perfil, cuentas y tokens, y deja las sesiones con user_id null', async () => {
    const user = makeUser();
    await repos.users.create(user);
    await repos.profiles.create(makeProfile(user.id));
    const account = makeAccount(user.id);
    await repos.accounts.create(account);
    const token = makeToken(user.id);
    await repos.oneTimeTokens.create(token);
    const session = makeSession(user.id);
    await repos.sessions.create(session);

    await repos.users.delete(user.id);

    expect(await repos.users.findById(user.id)).toBeNull();
    expect(await repos.profiles.findById(user.id)).toBeNull();
    expect(await repos.accounts.findById(account.id)).toBeNull();
    expect(await repos.oneTimeTokens.findByHash(token.tokenHash)).toBeNull();
    expect((await repos.sessions.findById(session.id))?.userId).toBeNull();
  });
});

describe('ProfileRepository', () => {
  it('guarda y recupera todos los campos, incluida la lista de monedas', async () => {
    const user = makeUser();
    await repos.users.create(user);
    await repos.profiles.create(makeProfile(user.id));

    await repos.profiles.save(
      makeProfile(user.id, {
        aiName: 'Juan',
        countryCode: 'CO',
        city: 'Barranquilla',
        primaryCurrency: 'COP',
        referenceCurrencies: ['USD', 'EUR'],
        aiMode: 'auto',
        onboardingStep: 'done',
        updatedAt: at,
      }),
    );

    expect(await repos.profiles.findById(user.id)).toMatchObject({
      aiName: 'Juan',
      countryCode: 'CO',
      city: 'Barranquilla',
      primaryCurrency: 'COP',
      referenceCurrencies: ['USD', 'EUR'],
      aiMode: 'auto',
      onboardingStep: 'done',
      updatedAt: at,
    });
  });

  it('un perfil nuevo arranca con ai_mode manual y sin monedas de referencia', async () => {
    const user = makeUser();
    await repos.users.create(user);
    await repos.profiles.create(makeProfile(user.id));
    expect(await repos.profiles.findById(user.id)).toMatchObject({
      aiMode: 'manual',
      onboardingStep: 'ai_name',
      referenceCurrencies: [],
    });
  });
});

describe('SessionRepository', () => {
  async function userWithSessions() {
    const user = makeUser();
    await repos.users.create(user);
    const a = makeSession(user.id);
    const b = makeSession(user.id);
    await repos.sessions.create(a);
    await repos.sessions.create(b);
    return { user, a, b };
  }

  it('revoke marca solo esa sesión y conserva el primer motivo', async () => {
    const { a, b } = await userWithSessions();
    await repos.sessions.revoke(a.id, 'logout', at);
    await repos.sessions.revoke(a.id, 'password_changed', new Date(at.getTime() + 1000));
    expect(await repos.sessions.findById(a.id)).toMatchObject({
      revokedAt: at,
      revokeReason: 'logout',
    });
    expect((await repos.sessions.findById(b.id))?.revokedAt).toBeNull();
  });

  it('revokeAllForUser respeta la sesión exceptuada', async () => {
    const { user, a, b } = await userWithSessions();
    await repos.sessions.revokeAllForUser(user.id, 'password_changed', at, a.id);
    expect((await repos.sessions.findById(a.id))?.revokedAt).toBeNull();
    expect(await repos.sessions.findById(b.id)).toMatchObject({
      revokedAt: at,
      revokeReason: 'password_changed',
    });
  });

  it('revokeActiveForDevice solo toca las sesiones de ese dispositivo', async () => {
    const { user, a, b } = await userWithSessions();
    await repos.sessions.revokeActiveForDevice(user.id, a.deviceId, 'replaced', at);
    expect(await repos.sessions.findById(a.id)).toMatchObject({ revokeReason: 'replaced' });
    expect((await repos.sessions.findById(b.id))?.revokedAt).toBeNull();
  });

  it('markAccountDeleted marca todas, incluso las ya revocadas, y borra el nombre del dispositivo', async () => {
    const { user, a, b } = await userWithSessions();
    await repos.sessions.revoke(a.id, 'logout', new Date('2026-10-22T13:00:00.000Z'));
    await repos.sessions.markAccountDeleted(user.id, at);
    for (const id of [a.id, b.id]) {
      expect(await repos.sessions.findById(id)).toMatchObject({
        revokedAt: at,
        revokeReason: 'account_deleted',
        deviceName: null,
      });
    }
  });

  const rotation = (previous: string) => ({
    refreshTokenHash: 'c'.repeat(64),
    previousRefreshTokenHash: previous,
    rotatedAt: at,
    lastUsedAt: at,
    expiresAt: new Date(at.getTime() + 30 * 24 * 60 * 60 * 1000),
  });

  it('rotate persiste la rotación del refresh token', async () => {
    const { a } = await userWithSessions();
    expect(
      await repos.sessions.rotate(a.id, a.refreshTokenHash, rotation(a.refreshTokenHash)),
    ).toBe(true);
    expect(await repos.sessions.findById(a.id)).toMatchObject({
      refreshTokenHash: 'c'.repeat(64),
      previousRefreshTokenHash: 'a'.repeat(64),
      rotatedAt: at,
    });
  });

  it('rotate no revive una sesión revocada', async () => {
    const { a } = await userWithSessions();
    await repos.sessions.revoke(a.id, 'password_reset', at);
    expect(
      await repos.sessions.rotate(a.id, a.refreshTokenHash, rotation(a.refreshTokenHash)),
    ).toBe(false);
    expect(await repos.sessions.findById(a.id)).toMatchObject({
      revokedAt: at,
      revokeReason: 'password_reset',
      refreshTokenHash: a.refreshTokenHash,
    });
  });

  it('rotate no pisa una rotación hecha por otra petición', async () => {
    const { a } = await userWithSessions();
    expect(await repos.sessions.rotate(a.id, 'd'.repeat(64), rotation(a.refreshTokenHash))).toBe(
      false,
    );
    expect((await repos.sessions.findById(a.id))?.refreshTokenHash).toBe(a.refreshTokenHash);
  });

  it('purgeBefore borra sesiones vencidas o revocadas antes de la fecha y deja las vigentes', async () => {
    const user = makeUser();
    await repos.users.create(user);
    const expired = makeSession(user.id, { expiresAt: new Date('2026-09-01T00:00:00.000Z') });
    const revokedOld = makeSession(user.id, { revokedAt: new Date('2026-09-01T00:00:00.000Z') });
    const revokedRecent = makeSession(user.id, { revokedAt: new Date('2026-10-20T00:00:00.000Z') });
    const active = makeSession(user.id);
    for (const s of [expired, revokedOld, revokedRecent, active]) await repos.sessions.create(s);

    const deleted = await repos.sessions.purgeBefore(new Date('2026-10-01T00:00:00.000Z'));

    expect(deleted).toBe(2);
    expect(await repos.sessions.findById(expired.id)).toBeNull();
    expect(await repos.sessions.findById(revokedOld.id)).toBeNull();
    expect(await repos.sessions.findById(revokedRecent.id)).not.toBeNull();
    expect(await repos.sessions.findById(active.id)).not.toBeNull();
  });
});

describe('OneTimeTokenRepository', () => {
  it('invalidateActive invalida los vigentes del mismo tipo y no toca usados ni de otro tipo', async () => {
    const user = makeUser();
    await repos.users.create(user);
    const active = makeToken(user.id);
    const used = makeToken(user.id, { usedAt: at });
    const otherKind = makeToken(user.id, { kind: 'password_reset' });
    for (const t of [active, used, otherKind]) await repos.oneTimeTokens.create(t);

    await repos.oneTimeTokens.invalidateActive(user.id, 'email_verification', at);

    expect((await repos.oneTimeTokens.findByHash(active.tokenHash))?.invalidatedAt).toEqual(at);
    expect((await repos.oneTimeTokens.findByHash(used.tokenHash))?.invalidatedAt).toBeNull();
    expect((await repos.oneTimeTokens.findByHash(otherKind.tokenHash))?.invalidatedAt).toBeNull();
  });

  it('markUsed registra el uso y purgeBefore borra los vencidos', async () => {
    const user = makeUser();
    await repos.users.create(user);
    const old = makeToken(user.id, { expiresAt: new Date('2026-09-01T00:00:00.000Z') });
    const fresh = makeToken(user.id);
    await repos.oneTimeTokens.create(old);
    await repos.oneTimeTokens.create(fresh);

    await repos.oneTimeTokens.markUsed(fresh.id, at);
    expect((await repos.oneTimeTokens.findByHash(fresh.tokenHash))?.usedAt).toEqual(at);

    expect(await repos.oneTimeTokens.purgeBefore(new Date('2026-10-01T00:00:00.000Z'))).toBe(1);
    expect(await repos.oneTimeTokens.findByHash(old.tokenHash)).toBeNull();
  });

  it('no permite dos tokens con el mismo hash', async () => {
    const user = makeUser();
    await repos.users.create(user);
    const token = makeToken(user.id);
    await repos.oneTimeTokens.create(token);
    await expect(repos.oneTimeTokens.create({ ...token, id: testId() })).rejects.toThrow();
  });
});

describe('AccountRepository', () => {
  it('guarda el saldo inicial como decimal exacto y lo devuelve sin ceros de relleno', async () => {
    const user = makeUser();
    await repos.users.create(user);
    const account = makeAccount(user.id, { initialBalance: '1234.5' });
    await repos.accounts.create(account);
    expect((await repos.accounts.findById(account.id))?.initialBalance).toBe('1234.5');
  });

  it('la migración deja las cuentas existentes como efectivo y activas', async () => {
    const user = makeUser();
    await repos.users.create(user);
    const id = testId();
    // Como las filas creadas antes de la 002: sin tipo ni archivado.
    await client`insert into accounts (id, user_id, name, currency, is_default)
      values (${id}, ${user.id}, 'Efectivo', 'COP', true)`;
    expect(await repos.accounts.findById(id)).toMatchObject({ type: 'cash', archivedAt: null });
  });

  it('upsert crea y luego reemplaza la cuenta sin duplicarla', async () => {
    const user = makeUser();
    await repos.users.create(user);
    const account = makeAccount(user.id);
    await repos.accounts.upsert(account);
    await repos.accounts.upsert({ ...account, name: 'Billetera', updatedAt: at });
    const all = await repos.accounts.listByUser(user.id);
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe('Billetera');
  });

  it('nombre único entre activas sin distinguir mayúsculas; una archivada no lo ocupa', async () => {
    const user = makeUser();
    await repos.users.create(user);
    await repos.accounts.create(makeAccount(user.id, { name: 'Nequi', isDefault: false }));
    await expect(
      repos.accounts.create(makeAccount(user.id, { name: 'nequi', isDefault: false })),
    ).rejects.toThrow();

    const other = makeUser();
    await repos.users.create(other);
    await repos.accounts.create(
      makeAccount(other.id, { name: 'Nequi', isDefault: false, archivedAt: at }),
    );
    await repos.accounts.create(makeAccount(other.id, { name: 'nequi', isDefault: false }));
  });

  it('clearDefaultExcept deja marcar otra cuenta por defecto sin chocar con el índice', async () => {
    const user = makeUser();
    await repos.users.create(user);
    const efectivo = makeAccount(user.id);
    const nequi = makeAccount(user.id, { name: 'Nequi', isDefault: false });
    await repos.accounts.create(efectivo);
    await repos.accounts.create(nequi);
    await repos.accounts.clearDefaultExcept(user.id, nequi.id, at);
    await repos.accounts.upsert({ ...nequi, isDefault: true, updatedAt: at });
    expect((await repos.accounts.findDefaultByUser(user.id))?.id).toBe(nequi.id);
    expect((await repos.accounts.findById(efectivo.id))?.isDefault).toBe(false);
  });

  it('findDefaultByUser devuelve la cuenta por defecto y no las borradas', async () => {
    const user = makeUser();
    await repos.users.create(user);
    const deleted = makeAccount(user.id, { deletedAt: at });
    await repos.accounts.create(deleted);
    expect(await repos.accounts.findDefaultByUser(user.id)).toBeNull();

    const account = makeAccount(user.id);
    await repos.accounts.create(account);
    expect((await repos.accounts.findDefaultByUser(user.id))?.id).toBe(account.id);
  });

  it('solo puede haber una cuenta por defecto activa por usuario', async () => {
    const user = makeUser();
    await repos.users.create(user);
    await repos.accounts.create(makeAccount(user.id));
    await expect(repos.accounts.create(makeAccount(user.id, { name: 'Nequi' }))).rejects.toThrow();
    // otro usuario sí puede tener la suya
    const other = makeUser();
    await repos.users.create(other);
    await repos.accounts.create(makeAccount(other.id));
  });
});

describe('TransactionRepository', () => {
  async function setup() {
    const user = makeUser();
    await repos.users.create(user);
    const efectivo = makeAccount(user.id, { initialBalance: '100000' });
    const nequi = makeAccount(user.id, { name: 'Nequi', isDefault: false });
    const usd = makeAccount(user.id, {
      name: 'Ahorros USD',
      isDefault: false,
      currency: 'USD',
      initialBalance: '50.25',
    });
    for (const account of [efectivo, nequi, usd]) await repos.accounts.create(account);
    return { user, efectivo, nequi, usd };
  }

  const transfer = (amount: string, toAccountId: string, toAmount: string) => ({
    type: 'transfer' as const,
    categorySlug: null,
    amount,
    toAccountId,
    toAmount,
    toCurrency: 'COP',
  });

  it('upsert es idempotente y guarda montos exactos', async () => {
    const { user, efectivo } = await setup();
    const tx = makeTransaction(user.id, efectivo.id, { amount: '18000' });
    await repos.transactions.upsert(tx);
    await repos.transactions.upsert(tx);
    expect(await repos.transactions.findById(tx.id)).toMatchObject({
      amount: '18000',
      categorySlug: 'dining',
      occurredOn: tx.occurredOn,
    });
  });

  it('balanceOf suma ingresos, gastos, ajustes y transferencias, sin los borrados', async () => {
    const { user, efectivo, nequi, usd } = await setup();
    const rows = [
      makeTransaction(user.id, efectivo.id, {
        type: 'income',
        categorySlug: 'salary',
        amount: '50000',
      }),
      makeTransaction(user.id, efectivo.id, { amount: '30000' }),
      makeTransaction(user.id, efectivo.id, {
        type: 'adjustment',
        categorySlug: null,
        amount: '-5000',
      }),
      makeTransaction(user.id, efectivo.id, transfer('20000', nequi.id, '20000')),
      makeTransaction(user.id, usd.id, {
        ...transfer('10.25', nequi.id, '40000'),
        currency: 'USD',
      }),
      makeTransaction(user.id, efectivo.id, { amount: '99999', deletedAt: at }),
    ];
    for (const row of rows) await repos.transactions.upsert(row);

    // 100.000 + 50.000 − 30.000 − 5.000 − 20.000 = 95.000
    expect(await repos.transactions.balanceOf(efectivo.id)).toBe('95000');
    // 0 + 20.000 + 40.000 = 60.000
    expect(await repos.transactions.balanceOf(nequi.id)).toBe('60000');
    // 50,25 − 10,25 = 40
    expect(await repos.transactions.balanceOf(usd.id)).toBe('40');
  });

  it('existsForAccount ve movimientos como origen y como destino, no los borrados', async () => {
    const { user, efectivo, nequi, usd } = await setup();
    expect(await repos.transactions.existsForAccount(nequi.id)).toBe(false);
    await repos.transactions.upsert(
      makeTransaction(user.id, efectivo.id, transfer('18000', nequi.id, '18000')),
    );
    expect(await repos.transactions.existsForAccount(nequi.id)).toBe(true);
    await repos.transactions.upsert(
      makeTransaction(user.id, usd.id, { currency: 'USD', amount: '1', deletedAt: at }),
    );
    expect(await repos.transactions.existsForAccount(usd.id)).toBe(false);
  });

  it('la base rechaza un gasto sin categoría (CHECK por tipo)', async () => {
    const { user, efectivo } = await setup();
    await expect(
      repos.transactions.upsert(makeTransaction(user.id, efectivo.id, { categorySlug: null })),
    ).rejects.toThrow();
  });

  it('borrar el usuario borra sus movimientos en cascada (FR-041)', async () => {
    const { user, efectivo } = await setup();
    const tx = makeTransaction(user.id, efectivo.id);
    await repos.transactions.upsert(tx);
    await repos.users.delete(user.id);
    expect(await repos.transactions.findById(tx.id)).toBeNull();
  });
});

describe('DrizzleUnitOfWork', () => {
  it('confirma todas las operaciones si el trabajo termina bien', async () => {
    const user = makeUser();
    await new DrizzleUnitOfWork(db).run(async (tx) => {
      await tx.users.create(user);
      await tx.profiles.create(makeProfile(user.id));
      await tx.sessions.create(makeSession(user.id));
    });
    expect(await repos.users.findById(user.id)).not.toBeNull();
    expect(await repos.profiles.findById(user.id)).not.toBeNull();
  });

  it('deshace todas las operaciones si el trabajo lanza un error', async () => {
    const user = makeUser();
    await expect(
      new DrizzleUnitOfWork(db).run(async (tx) => {
        await tx.users.create(user);
        await tx.profiles.create(makeProfile(user.id));
        throw new Error('falla a mitad de camino');
      }),
    ).rejects.toThrow('falla a mitad de camino');
    expect(await repos.users.findById(user.id)).toBeNull();
    expect(await repos.profiles.findById(user.id)).toBeNull();
  });
});
