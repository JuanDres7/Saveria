import { beforeEach, describe, expect, it } from 'bun:test';
import { MAX_ACTIVE_ACCOUNTS } from '@saveria/shared';
import {
  type AccountInputDto,
  createSaveAccount,
} from '../../src/application/use-cases/save-account';
import type { Account } from '../../src/domain/entities';
import { DomainError } from '../../src/domain/errors';
import { makeAccount, makeProfile, makeTransaction, makeUser, testId } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

let deps: UseCaseDeps;
let saveAccount: ReturnType<typeof createSaveAccount>;
let userId: string;
let efectivo: Account;

const ARCHIVED = '2026-10-21T00:00:00.000Z';
const later = (ms = 1000) => new Date(Date.parse('2026-10-22T12:00:00.000Z') + ms).toISOString();

beforeEach(async () => {
  deps = createUseCaseDeps();
  saveAccount = createSaveAccount(deps);
  const user = makeUser();
  userId = user.id;
  await deps.repositories.users.create(user);
  await deps.repositories.profiles.create(makeProfile(userId, { primaryCurrency: 'COP' }));
  efectivo = makeAccount(userId);
  await deps.repositories.accounts.create(efectivo);
});

const input = (overrides: Partial<AccountInputDto> = {}): AccountInputDto => ({
  name: 'Nequi',
  type: 'wallet',
  currency: 'COP',
  initialBalance: '80000',
  isDefault: false,
  archivedAt: null,
  updatedAt: later(),
  ...overrides,
});

/** La cuenta "Efectivo" tal como la mandaría el teléfono, con cambios. */
const efectivoInput = (overrides: Partial<AccountInputDto> = {}): AccountInputDto => ({
  name: efectivo.name,
  type: efectivo.type,
  currency: efectivo.currency,
  initialBalance: efectivo.initialBalance,
  isDefault: efectivo.isDefault,
  archivedAt: null,
  updatedAt: later(),
  ...overrides,
});

async function errorOf(promise: Promise<unknown>): Promise<DomainError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DomainError);
  return error as DomainError;
}

describe('saveAccount', () => {
  it('3.1 crea la cuenta con el id del cliente', async () => {
    const id = testId();
    const result = await saveAccount(userId, id, input());
    expect(result.status).toBe('saved');
    expect(result.account).toMatchObject({ id, name: 'Nequi', initialBalance: '80000' });
    expect(deps.store.accounts.get(id)?.userId).toBe(userId);
  });

  it('3.5 nombre repetido entre activas, sin distinguir mayúsculas → validation_error en name', async () => {
    const error = await errorOf(saveAccount(userId, testId(), input({ name: 'efectivo' })));
    expect(error.code).toBe('validation_error');
    expect(error.fields?.name).toBeDefined();
  });

  it('FR-023 la cuenta activa número 21 → validation_error', async () => {
    for (let i = 1; i < MAX_ACTIVE_ACCOUNTS; i++) {
      await deps.repositories.accounts.create(
        makeAccount(userId, { name: `C${i}`, isDefault: false }),
      );
    }
    const error = await errorOf(saveAccount(userId, testId(), input()));
    expect(error.code).toBe('validation_error');
  });

  it('3.3 marcar una cuenta por defecto desmarca las demás', async () => {
    const id = testId();
    await saveAccount(userId, id, input({ isDefault: true }));
    expect(deps.store.accounts.get(id)?.isDefault).toBe(true);
    expect(deps.store.accounts.get(efectivo.id)?.isDefault).toBe(false);
  });

  it('FR-020 quitar la marca a la única cuenta por defecto → validation_error', async () => {
    const error = await errorOf(
      saveAccount(userId, efectivo.id, efectivoInput({ isDefault: false })),
    );
    expect(error.fields?.isDefault).toBeDefined();
  });

  it('3.7 archivar la cuenta por defecto → validation_error', async () => {
    const error = await errorOf(
      saveAccount(userId, efectivo.id, efectivoInput({ archivedAt: ARCHIVED })),
    );
    expect(error.fields?.archivedAt).toBeDefined();
  });

  it('3.6 archivar una cuenta con saldo está permitido', async () => {
    const id = testId();
    await saveAccount(userId, id, input());
    const result = await saveAccount(
      userId,
      id,
      input({ archivedAt: ARCHIVED, updatedAt: later(2000) }),
    );
    expect(result.status).toBe('saved');
    expect(deps.store.accounts.get(id)?.archivedAt?.toISOString()).toBe(ARCHIVED);
  });

  it('3.8 la moneda no cambia con movimientos vivos como origen', async () => {
    await deps.repositories.transactions.upsert(makeTransaction(userId, efectivo.id));
    const error = await errorOf(
      saveAccount(userId, efectivo.id, efectivoInput({ currency: 'USD', initialBalance: '0' })),
    );
    expect(error.fields?.currency).toBeDefined();
  });

  it('3.8 la moneda no cambia con movimientos vivos como destino', async () => {
    const id = testId();
    await saveAccount(userId, id, input());
    await deps.repositories.transactions.upsert(
      makeTransaction(userId, efectivo.id, {
        type: 'transfer',
        categorySlug: null,
        toAccountId: id,
        toAmount: '18000',
        toCurrency: 'COP',
      }),
    );
    const error = await errorOf(
      saveAccount(
        userId,
        id,
        input({ currency: 'USD', initialBalance: '0', updatedAt: later(2000) }),
      ),
    );
    expect(error.fields?.currency).toBeDefined();
  });

  it('la moneda sí cambia sin movimientos', async () => {
    const id = testId();
    await saveAccount(userId, id, input());
    const result = await saveAccount(
      userId,
      id,
      input({ currency: 'USD', initialBalance: '10.50', updatedAt: later(2000) }),
    );
    expect(result.account.currency).toBe('USD');
  });

  it('FR-021 reactivar con un nombre que ya usa otra activa → validation_error en name', async () => {
    const id = testId();
    await saveAccount(userId, id, input({ archivedAt: ARCHIVED }));
    await saveAccount(userId, testId(), input({ name: 'NEQUI' }));
    const error = await errorOf(saveAccount(userId, id, input({ updatedAt: later(3000) })));
    expect(error.fields?.name).toBeDefined();
  });

  it('FR-021 reactivar con 20 activas → validation_error', async () => {
    const id = testId();
    await saveAccount(userId, id, input({ name: 'Vieja', archivedAt: ARCHIVED }));
    for (let i = 1; i < MAX_ACTIVE_ACCOUNTS; i++) {
      await deps.repositories.accounts.create(
        makeAccount(userId, { name: `C${i}`, isDefault: false }),
      );
    }
    const error = await errorOf(
      saveAccount(userId, id, input({ name: 'Vieja', updatedAt: later(3000) })),
    );
    expect(error.fields?.archivedAt).toBeDefined();
  });

  it('valida el saldo inicial con los decimales de la moneda', async () => {
    const error = await errorOf(saveAccount(userId, testId(), input({ initialBalance: '10.5' })));
    expect(error.fields?.initialBalance).toBeDefined();
  });

  it('FR-008 sin moneda principal → primary_currency_required', async () => {
    await deps.repositories.profiles.save(makeProfile(userId, { primaryCurrency: null }));
    const error = await errorOf(saveAccount(userId, testId(), input()));
    expect(error.code).toBe('primary_currency_required');
  });

  it('repetir el mismo envío responde saved sin cambiar nada', async () => {
    const id = testId();
    await saveAccount(userId, id, input());
    const again = await saveAccount(userId, id, input());
    expect(again.status).toBe('saved');
  });

  it('LWW: un cambio igual de viejo con otro contenido, o más viejo → conflict', async () => {
    const id = testId();
    await saveAccount(userId, id, input({ updatedAt: later(5000) }));
    const older = await saveAccount(userId, id, input({ name: 'Otra', updatedAt: later(1000) }));
    expect(older.status).toBe('conflict');
    expect(older.account.name).toBe('Nequi');
  });

  it('el id de una cuenta de otro usuario → not_found', async () => {
    const other = makeUser({ email: 'otro@mail.com' });
    await deps.repositories.users.create(other);
    const foreign = makeAccount(other.id);
    await deps.repositories.accounts.create(foreign);
    const error = await errorOf(saveAccount(userId, foreign.id, input()));
    expect(error.code).toBe('not_found');
  });
});
