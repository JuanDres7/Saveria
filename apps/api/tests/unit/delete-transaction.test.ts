import { beforeEach, describe, expect, it } from 'bun:test';
import { createDeleteTransaction } from '../../src/application/use-cases/delete-transaction';
import {
  createSaveTransaction,
  type TransactionInputDto,
} from '../../src/application/use-cases/save-transaction';
import { DomainError } from '../../src/domain/errors';
import { makeAccount, makeProfile, makeTransaction, makeUser, testId } from '../support/builders';
import { createUseCaseDeps, type UseCaseDeps } from '../support/use-case-deps';

let deps: UseCaseDeps;
let deleteTransaction: ReturnType<typeof createDeleteTransaction>;
let saveTransaction: ReturnType<typeof createSaveTransaction>;
let userId: string;
let accountId: string;

const later = (ms = 1000) => new Date(Date.parse('2026-10-22T12:00:00.000Z') + ms).toISOString();

beforeEach(async () => {
  deps = createUseCaseDeps();
  deleteTransaction = createDeleteTransaction(deps);
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

describe('deleteTransaction', () => {
  it('4.4 marca deleted_at con la hora del teléfono', async () => {
    const id = testId();
    await saveTransaction(userId, id, expense());
    const result = await deleteTransaction(userId, id, { updatedAt: later(2000) });
    expect(result.status).toBe('deleted');
    const stored = deps.store.transactions.get(id);
    expect(stored?.deletedAt?.toISOString()).toBe(later(2000));
    expect(stored?.updatedAt.toISOString()).toBe(later(2000));
    // El movimiento sigue en la base (borrado lógico) pero ya no cuenta en el saldo.
    expect(await deps.repositories.transactions.balanceOf(accountId)).toBe('0');
  });

  it('repetir el mismo borrado da el mismo resultado', async () => {
    const id = testId();
    await saveTransaction(userId, id, expense());
    await deleteTransaction(userId, id, { updatedAt: later(2000) });
    const again = await deleteTransaction(userId, id, { updatedAt: later(2000) });
    expect(again.status).toBe('deleted');
    expect(deps.store.transactions.size).toBe(1);
  });

  it('un id que el servidor no conoce (creado y borrado sin conexión) → éxito sin crear nada', async () => {
    const result = await deleteTransaction(userId, testId(), { updatedAt: later() });
    expect(result.status).toBe('deleted');
    expect(deps.store.transactions.size).toBe(0);
  });

  it('un borrado más viejo que la versión guardada → conflict con esa versión', async () => {
    const id = testId();
    await saveTransaction(userId, id, expense({ updatedAt: later(5000) }));
    const result = await deleteTransaction(userId, id, { updatedAt: later(1000) });
    expect(result.status).toBe('conflict');
    if (result.status === 'conflict') expect(result.transaction.deletedAt).toBeNull();
    expect(deps.store.transactions.get(id)?.deletedAt).toBeNull();
  });

  it('el id de un movimiento de otro usuario → not_found', async () => {
    const other = makeUser({ email: 'otro@mail.com' });
    await deps.repositories.users.create(other);
    const foreignAccount = makeAccount(other.id);
    await deps.repositories.accounts.create(foreignAccount);
    const foreign = makeTransaction(other.id, foreignAccount.id);
    await deps.repositories.transactions.upsert(foreign);
    const error = await errorOf(deleteTransaction(userId, foreign.id, { updatedAt: later() }));
    expect(error.code).toBe('not_found');
    expect(deps.store.transactions.get(foreign.id)?.deletedAt).toBeNull();
  });

  it('4.5 un PUT posterior con deletedAt: null lo restaura ("Deshacer")', async () => {
    const id = testId();
    await saveTransaction(userId, id, expense());
    await deleteTransaction(userId, id, { updatedAt: later(2000) });
    const restored = await saveTransaction(userId, id, expense({ updatedAt: later(3000) }));
    expect(restored.status).toBe('saved');
    expect(deps.store.transactions.get(id)?.deletedAt).toBeNull();
    expect(await deps.repositories.transactions.balanceOf(accountId)).toBe('-18000');
  });

  it('un PUT viejo no revive un movimiento borrado después (LWW)', async () => {
    const id = testId();
    await saveTransaction(userId, id, expense());
    await deleteTransaction(userId, id, { updatedAt: later(5000) });
    const stale = await saveTransaction(userId, id, expense({ updatedAt: later(2000) }));
    expect(stale.status).toBe('conflict');
    expect(deps.store.transactions.get(id)?.deletedAt).not.toBeNull();
  });
});
