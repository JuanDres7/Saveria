import { makeTransactionInputSchema, type TransactionType, utcToday } from '@saveria/shared';
import type { Account, Transaction } from '../../domain/entities';
import { DomainError } from '../../domain/errors';
import type { TransactionDto } from '../dto';
import type { Repositories, UnitOfWork } from '../ports/repositories';
import type { Clock } from '../ports/services';
import { normalizeDecimal } from './get-me';

/** Lo que manda el teléfono: el movimiento completo con su `updatedAt` (contrato TransactionInput). */
export interface TransactionInputDto {
  type: string;
  accountId: string;
  amount: string;
  currency: string;
  toAccountId: string | null;
  toAmount: string | null;
  toCurrency: string | null;
  categorySlug: string | null;
  description: string | null;
  occurredOn: string;
  deletedAt: string | null;
  updatedAt: string;
}

export type SaveTransactionResult =
  | { status: 'saved'; transaction: TransactionDto }
  /** El servidor tiene una versión igual de nueva con otro contenido, o más nueva (409). */
  | { status: 'conflict'; transaction: TransactionDto };

export interface SaveTransactionDeps {
  uow: UnitOfWork;
  clock: Clock;
}

export function toTransactionDto(transaction: Transaction): TransactionDto {
  return {
    id: transaction.id,
    type: transaction.type,
    accountId: transaction.accountId,
    amount: transaction.amount,
    currency: transaction.currency,
    toAccountId: transaction.toAccountId,
    toAmount: transaction.toAmount,
    toCurrency: transaction.toCurrency,
    categorySlug: transaction.categorySlug,
    description: transaction.description,
    occurredOn: transaction.occurredOn,
    deletedAt: transaction.deletedAt?.toISOString() ?? null,
    updatedAt: transaction.updatedAt.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
  };
}

/** Campos que, si coinciden, hacen de dos envíos el mismo (un reintento de red). */
const sameContent = (a: TransactionDto, b: Omit<TransactionDto, 'id' | 'createdAt'>) =>
  (Object.keys(b) as (keyof typeof b)[]).every((key) => a[key] === b[key]);

async function ownAccount(
  repos: Repositories,
  userId: string,
  id: string,
): Promise<Account | null> {
  const account = await repos.accounts.findById(id);
  return account && account.userId === userId && account.deletedAt === null ? account : null;
}

/**
 * El único caso de uso que guarda movimientos (Constitución I, research §10): lo usan el
 * formulario manual y, desde la feature 004, las acciones confirmadas de la IA. Crea o reemplaza
 * el movimiento con el id del teléfono y last-write-wins por `updatedAt` (research §3).
 */
export function createSaveTransaction({ uow, clock }: SaveTransactionDeps) {
  return async function saveTransaction(
    userId: string,
    id: string,
    input: TransactionInputDto,
  ): Promise<SaveTransactionResult> {
    // El servidor usa su "hoy" en UTC con 1 día de tolerancia por las zonas horarias (research §8).
    const schema = makeTransactionInputSchema({
      today: () => utcToday(clock.now()),
      toleranceDays: 1,
    });

    return uow.run(async (repos) => {
      const profile = await repos.profiles.findById(userId);
      if (!profile) throw new DomainError('unauthorized');
      if (profile.primaryCurrency === null) throw new DomainError('primary_currency_required');

      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          fields[String(issue.path[0] ?? 'body')] ??= issue.message;
        }
        throw new DomainError('validation_error', { fields });
      }
      // Mismo formato que devuelve la base ("12.50" → "12.5"), para comparar reenvíos.
      const values = {
        ...parsed.data,
        amount: normalizeDecimal(parsed.data.amount),
        toAmount: parsed.data.toAmount === null ? null : normalizeDecimal(parsed.data.toAmount),
      };

      const existing = await repos.transactions.findById(id);
      if (existing && existing.userId !== userId) throw new DomainError('not_found');

      const updatedAt = new Date(values.updatedAt);
      if (existing) {
        const current = toTransactionDto(existing);
        const incoming = {
          ...values,
          type: values.type as TransactionType,
          deletedAt: values.deletedAt === null ? null : new Date(values.deletedAt).toISOString(),
          updatedAt: updatedAt.toISOString(),
        };
        const time = existing.updatedAt.getTime();
        if (time === updatedAt.getTime() && sameContent(current, incoming)) {
          return { status: 'saved', transaction: current };
        }
        if (time >= updatedAt.getTime()) return { status: 'conflict', transaction: current };
      }

      const fields: Record<string, string> = {};
      const account = await ownAccount(repos, userId, values.accountId);
      if (!account) fields.accountId = 'La cuenta no existe';
      else if (account.currency !== values.currency) {
        fields.currency = 'La moneda debe ser la de la cuenta';
      }
      if (values.type === 'transfer' && values.toAccountId !== null) {
        const target = await ownAccount(repos, userId, values.toAccountId);
        if (!target) fields.toAccountId = 'La cuenta de destino no existe';
        else if (target.currency !== values.toCurrency) {
          fields.toCurrency = 'La moneda de destino debe ser la de esa cuenta';
        }
      }
      if (Object.keys(fields).length > 0) throw new DomainError('validation_error', { fields });

      const transaction: Transaction = {
        id,
        userId,
        type: values.type,
        accountId: values.accountId,
        amount: values.amount,
        currency: values.currency,
        toAccountId: values.toAccountId,
        toAmount: values.toAmount,
        toCurrency: values.toCurrency,
        categorySlug: values.categorySlug,
        description: values.description,
        occurredOn: values.occurredOn,
        createdAt: existing?.createdAt ?? clock.now(),
        updatedAt,
        deletedAt: values.deletedAt === null ? null : new Date(values.deletedAt),
      };
      await repos.transactions.upsert(transaction);
      return { status: 'saved', transaction: toTransactionDto(transaction) };
    });
  };
}
