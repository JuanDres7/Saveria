import { beforeEach, describe, expect, it } from 'bun:test';
import {
  createSaveTransaction,
  type TransactionInputDto,
} from '../../src/application/use-cases/save-transaction';
import type { Account } from '../../src/domain/entities';
import { DomainError } from '../../src/domain/errors';
import { makeAccount, makeProfile, makeUser, testId } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

let deps: UseCaseDeps;
let saveTransaction: ReturnType<typeof createSaveTransaction>;
let userId: string;
let efectivo: Account;
let nequi: Account;
let usd: Account;

const later = (ms = 1000) => new Date(Date.parse('2026-10-22T12:00:00.000Z') + ms).toISOString();

beforeEach(async () => {
  deps = createUseCaseDeps();
  saveTransaction = createSaveTransaction(deps);
  const user = makeUser();
  userId = user.id;
  await deps.repositories.users.create(user);
  await deps.repositories.profiles.create(makeProfile(userId, { primaryCurrency: 'COP' }));
  efectivo = makeAccount(userId);
  nequi = makeAccount(userId, { name: 'Nequi', isDefault: false });
  usd = makeAccount(userId, { name: 'Ahorros USD', isDefault: false, currency: 'USD' });
  for (const account of [efectivo, nequi, usd]) await deps.repositories.accounts.create(account);
});

const transfer = (overrides: Partial<TransactionInputDto> = {}): TransactionInputDto => ({
  type: 'transfer',
  accountId: efectivo.id,
  amount: '100000',
  currency: 'COP',
  toAccountId: nequi.id,
  toAmount: '100000',
  toCurrency: 'COP',
  categorySlug: null,
  description: null,
  occurredOn: '2026-10-22',
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

describe('saveTransaction: transferencias', () => {
  it('5.1 guarda una sola fila con origen y destino', async () => {
    const id = testId();
    const result = await saveTransaction(userId, id, transfer());
    expect(result.status).toBe('saved');
    expect(result.transaction).toMatchObject({
      type: 'transfer',
      accountId: efectivo.id,
      toAccountId: nequi.id,
      amount: '100000',
      toAmount: '100000',
      categorySlug: null,
    });
    expect(deps.store.transactions.size).toBe(1);
  });

  it('5.3 entre monedas distintas guarda los dos montos sin calcular ninguna tasa', async () => {
    const result = await saveTransaction(
      userId,
      testId(),
      transfer({
        accountId: usd.id,
        currency: 'USD',
        amount: '10.25',
        toAmount: '40000',
        toCurrency: 'COP',
      }),
    );
    expect(result.transaction).toMatchObject({ amount: '10.25', toAmount: '40000' });
  });

  it('5.4 la misma cuenta de origen y destino → validation_error en toAccountId', async () => {
    const error = await errorOf(
      saveTransaction(userId, testId(), transfer({ toAccountId: efectivo.id })),
    );
    expect(error.fields?.toAccountId).toBeDefined();
  });

  it('toCurrency distinta de la moneda de la cuenta de destino → validation_error', async () => {
    const error = await errorOf(
      saveTransaction(userId, testId(), transfer({ toAccountId: usd.id, toCurrency: 'COP' })),
    );
    expect(error.fields?.toCurrency).toBeDefined();
  });

  it('FR-028 con categoría → validation_error', async () => {
    const error = await errorOf(
      saveTransaction(userId, testId(), transfer({ categorySlug: 'dining' })),
    );
    expect(error.fields?.categorySlug).toBeDefined();
  });

  it('con la misma moneda, un monto que entra distinto del que sale → validation_error', async () => {
    const error = await errorOf(saveTransaction(userId, testId(), transfer({ toAmount: '90000' })));
    expect(error.fields?.toAmount).toBeDefined();
  });

  it('una cuenta de destino de otro usuario → validation_error', async () => {
    const other = makeUser({ email: 'otro@mail.com' });
    await deps.repositories.users.create(other);
    const foreign = makeAccount(other.id);
    await deps.repositories.accounts.create(foreign);
    const error = await errorOf(
      saveTransaction(userId, testId(), transfer({ toAccountId: foreign.id })),
    );
    expect(error.fields?.toAccountId).toBeDefined();
  });

  it('una cuenta de destino que no existe → validation_error', async () => {
    const error = await errorOf(
      saveTransaction(userId, testId(), transfer({ toAccountId: testId() })),
    );
    expect(error.fields?.toAccountId).toBeDefined();
  });

  it('sin monto de entrada ni moneda de entrada → validation_error', async () => {
    const error = await errorOf(
      saveTransaction(userId, testId(), transfer({ toAmount: null, toCurrency: null })),
    );
    expect(error.fields?.toAmount ?? error.fields?.toCurrency).toBeDefined();
  });
});
