import { beforeEach, describe, expect, it } from 'bun:test';
import {
  createSaveTransaction,
  type TransactionInputDto,
} from '../../src/application/use-cases/save-transaction';
import { DomainError } from '../../src/domain/errors';
import { makeAccount, makeProfile, makeTransaction, makeUser, testId } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

let deps: UseCaseDeps;
let saveTransaction: ReturnType<typeof createSaveTransaction>;
let userId: string;
let accountId: string;

// El reloj de pruebas marca 2026-10-22T12:00:00Z.
const TODAY = '2026-10-22';
const later = (ms = 1000) => new Date(Date.parse('2026-10-22T12:00:00.000Z') + ms).toISOString();

beforeEach(async () => {
  deps = createUseCaseDeps();
  saveTransaction = createSaveTransaction(deps);
  const user = makeUser();
  userId = user.id;
  await deps.repositories.users.create(user);
  await deps.repositories.profiles.create(makeProfile(userId, { primaryCurrency: 'COP' }));
  const account = makeAccount(userId);
  accountId = account.id;
  await deps.repositories.accounts.create(account);
});

const expense = (overrides: Partial<TransactionInputDto> = {}): TransactionInputDto => ({
  type: 'expense',
  accountId,
  amount: '18000',
  currency: 'COP',
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
  categorySlug: 'dining',
  description: 'Almuerzo',
  occurredOn: TODAY,
  deletedAt: null,
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

describe('saveTransaction: gastos e ingresos', () => {
  it('crea el gasto con el id del cliente y su updatedAt', async () => {
    const id = testId();
    const result = await saveTransaction(userId, id, expense());
    expect(result.status).toBe('saved');
    expect(result.transaction).toMatchObject({ id, amount: '18000', categorySlug: 'dining' });
    const stored = deps.store.transactions.get(id);
    expect(stored?.userId).toBe(userId);
    expect(stored?.updatedAt.toISOString()).toBe(later());
  });

  it('crea un ingreso', async () => {
    const result = await saveTransaction(
      userId,
      testId(),
      expense({ type: 'income', categorySlug: 'salary', amount: '2000000' }),
    );
    expect(result.transaction.type).toBe('income');
  });

  it.each([
    ['0', 'cero'],
    ['-18000', 'negativo'],
    ['1234567890123', 'más de 12 dígitos enteros'],
    ['18000.5', 'con decimales que COP no permite'],
  ])('1.5/1.6 monto %s (%s) → validation_error en amount', async (amount) => {
    const error = await errorOf(saveTransaction(userId, testId(), expense({ amount })));
    expect(error.code).toBe('validation_error');
    expect(error.fields?.amount).toBeDefined();
  });

  it('categoría de ingreso en un gasto → validation_error', async () => {
    const error = await errorOf(
      saveTransaction(userId, testId(), expense({ categorySlug: 'salary' })),
    );
    expect(error.fields?.categorySlug).toBeDefined();
  });

  it('FR-006 la moneda debe ser la de la cuenta', async () => {
    const error = await errorOf(
      saveTransaction(userId, testId(), expense({ currency: 'USD', amount: '10.00' })),
    );
    expect(error.fields?.currency).toBeDefined();
  });

  it('una cuenta de otro usuario → validation_error en accountId', async () => {
    const other = makeUser({ email: 'otro@mail.com' });
    await deps.repositories.users.create(other);
    const foreign = makeAccount(other.id);
    await deps.repositories.accounts.create(foreign);
    const error = await errorOf(
      saveTransaction(userId, testId(), expense({ accountId: foreign.id })),
    );
    expect(error.fields?.accountId).toBeDefined();
  });

  it('una cuenta que no existe → validation_error en accountId', async () => {
    const error = await errorOf(
      saveTransaction(userId, testId(), expense({ accountId: testId() })),
    );
    expect(error.fields?.accountId).toBeDefined();
  });

  it('FR-007 acepta hasta 1 día después del hoy UTC (zonas horarias), no más', async () => {
    await saveTransaction(userId, testId(), expense({ occurredOn: '2026-10-23' }));
    const error = await errorOf(
      saveTransaction(userId, testId(), expense({ occurredOn: '2026-10-24' })),
    );
    expect(error.fields?.occurredOn).toBeDefined();
  });

  it('FR-008 sin moneda principal → primary_currency_required', async () => {
    await deps.repositories.profiles.save(makeProfile(userId, { primaryCurrency: null }));
    const error = await errorOf(saveTransaction(userId, testId(), expense()));
    expect(error.code).toBe('primary_currency_required');
  });
});

describe('saveTransaction: idempotencia y last-write-wins', () => {
  it('1.7 repetir el mismo envío (reintento de red) responde saved sin duplicar', async () => {
    const id = testId();
    const body = expense();
    await saveTransaction(userId, id, body);
    const again = await saveTransaction(userId, id, body);
    expect(again.status).toBe('saved');
    expect(again.transaction.id).toBe(id);
    expect(deps.store.transactions.size).toBe(1);
  });

  it('otro contenido con el mismo updatedAt → conflict', async () => {
    const id = testId();
    await saveTransaction(userId, id, expense());
    const result = await saveTransaction(userId, id, expense({ amount: '1' }));
    expect(result.status).toBe('conflict');
  });

  it('un cambio más nuevo reemplaza al guardado', async () => {
    const id = testId();
    await saveTransaction(userId, id, expense());
    const result = await saveTransaction(
      userId,
      id,
      expense({ amount: '20000', updatedAt: later(2000) }),
    );
    expect(result.status).toBe('saved');
    expect(deps.store.transactions.get(id)?.amount).toBe('20000');
  });

  it('un cambio más viejo → conflict con la versión guardada', async () => {
    const id = testId();
    await saveTransaction(userId, id, expense({ updatedAt: later(5000) }));
    const result = await saveTransaction(
      userId,
      id,
      expense({ amount: '1', updatedAt: later(1000) }),
    );
    expect(result.status).toBe('conflict');
    expect(result.transaction.amount).toBe('18000');
  });

  it('el id de un movimiento de otro usuario → not_found', async () => {
    const other = makeUser({ email: 'otro@mail.com' });
    await deps.repositories.users.create(other);
    const foreignAccount = makeAccount(other.id);
    await deps.repositories.accounts.create(foreignAccount);
    const foreign = makeTransaction(other.id, foreignAccount.id);
    await deps.repositories.transactions.upsert(foreign);
    const error = await errorOf(saveTransaction(userId, foreign.id, expense()));
    expect(error.code).toBe('not_found');
  });
});
