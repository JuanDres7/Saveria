import { beforeEach, describe, expect, it } from 'bun:test';
import {
  createSaveTransaction,
  type TransactionInputDto,
} from '../../src/application/use-cases/save-transaction';
import { DomainError } from '../../src/domain/errors';
import { makeAccount, makeProfile, makeUser, testId } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

let deps: UseCaseDeps;
let saveTransaction: ReturnType<typeof createSaveTransaction>;
let userId: string;
let accountId: string;
let usdId: string;

const later = (ms = 1000) => new Date(Date.parse('2026-10-22T12:00:00.000Z') + ms).toISOString();

beforeEach(async () => {
  deps = createUseCaseDeps();
  saveTransaction = createSaveTransaction(deps);
  const user = makeUser();
  userId = user.id;
  await deps.repositories.users.create(user);
  await deps.repositories.profiles.create(makeProfile(userId, { primaryCurrency: 'COP' }));
  const account = makeAccount(userId, { initialBalance: '120000' });
  const usd = makeAccount(userId, { name: 'USD', isDefault: false, currency: 'USD' });
  accountId = account.id;
  usdId = usd.id;
  await deps.repositories.accounts.create(account);
  await deps.repositories.accounts.create(usd);
});

const adjustment = (overrides: Partial<TransactionInputDto> = {}): TransactionInputDto => ({
  type: 'adjustment',
  accountId,
  amount: '-5000',
  currency: 'COP',
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
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

describe('saveTransaction: ajustes de saldo', () => {
  it('6.1 un ajuste negativo baja el saldo sin tocar nada más', async () => {
    const result = await saveTransaction(userId, testId(), adjustment());
    expect(result.status).toBe('saved');
    expect(result.transaction).toMatchObject({ type: 'adjustment', amount: '-5000' });
    expect(await deps.repositories.transactions.balanceOf(accountId)).toBe('115000');
    expect(deps.store.transactions.size).toBe(1);
  });

  it('un ajuste positivo sube el saldo', async () => {
    await saveTransaction(userId, testId(), adjustment({ amount: '8000' }));
    expect(await deps.repositories.transactions.balanceOf(accountId)).toBe('128000');
  });

  it('un ajuste en dólares admite 2 decimales', async () => {
    const result = await saveTransaction(
      userId,
      testId(),
      adjustment({ accountId: usdId, currency: 'USD', amount: '-2.50' }),
    );
    expect(result.transaction.amount).toBe('-2.5');
  });

  it('un monto 0 → validation_error en amount', async () => {
    const error = await errorOf(saveTransaction(userId, testId(), adjustment({ amount: '0' })));
    expect(error.code).toBe('validation_error');
    expect(error.fields?.amount).toBeDefined();
  });

  it('FR-032 con categoría → validation_error en categorySlug', async () => {
    const error = await errorOf(
      saveTransaction(userId, testId(), adjustment({ categorySlug: 'other_expense' })),
    );
    expect(error.fields?.categorySlug).toBeDefined();
  });

  it('con campos de transferencia → validation_error', async () => {
    const error = await errorOf(
      saveTransaction(userId, testId(), adjustment({ toAccountId: usdId })),
    );
    expect(error.fields?.toAccountId).toBeDefined();
  });

  it('un monto con decimales que la moneda no permite → validation_error', async () => {
    const error = await errorOf(saveTransaction(userId, testId(), adjustment({ amount: '-5.5' })));
    expect(error.fields?.amount).toBeDefined();
  });

  it('6.4 borrarlo (un PUT con deletedAt) devuelve el saldo anterior', async () => {
    const id = testId();
    await saveTransaction(userId, id, adjustment());
    await saveTransaction(
      userId,
      id,
      adjustment({ deletedAt: later(2000), updatedAt: later(2000) }),
    );
    expect(await deps.repositories.transactions.balanceOf(accountId)).toBe('120000');
  });
});
