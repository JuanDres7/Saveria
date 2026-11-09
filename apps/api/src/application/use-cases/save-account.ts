import { type AccountRuleView, accountInputSchema, checkAccountChange } from '@saveria/shared';
import type { Account } from '../../domain/entities';
import { DomainError } from '../../domain/errors';
import type { AccountRecordDto } from '../dto';
import type { UnitOfWork } from '../ports/repositories';
import type { Clock } from '../ports/services';
import { normalizeDecimal } from './get-me';

/** Lo que manda el teléfono: la cuenta completa con su `updatedAt` (contrato AccountInput). */
export interface AccountInputDto {
  name: string;
  type: string;
  currency: string;
  initialBalance: string;
  isDefault: boolean;
  archivedAt: string | null;
  updatedAt: string;
}

export type SaveAccountResult =
  | { status: 'saved'; account: AccountRecordDto }
  /** El servidor tiene una versión igual de nueva con otro contenido, o más nueva (409). */
  | { status: 'conflict'; account: AccountRecordDto };

export interface SaveAccountDeps {
  uow: UnitOfWork;
  clock: Clock;
}

export function toAccountRecordDto(account: Account): AccountRecordDto {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    initialBalance: normalizeDecimal(account.initialBalance),
    isDefault: account.isDefault,
    archivedAt: account.archivedAt?.toISOString() ?? null,
    updatedAt: account.updatedAt.toISOString(),
    createdAt: account.createdAt.toISOString(),
  };
}

const ruleView = (account: Account): AccountRuleView => ({
  id: account.id,
  name: account.name,
  currency: account.currency,
  isDefault: account.isDefault,
  archivedAt: account.archivedAt,
});

/**
 * Crea o reemplaza una cuenta con el id del teléfono (historia 3). Last-write-wins por
 * `updatedAt` (research §3). Las reglas entre cuentas vienen de `checkAccountChange`, la misma
 * función que usa el teléfono (Constitución I); aquí se comprueban con los datos del servidor.
 */
export function createSaveAccount({ uow, clock }: SaveAccountDeps) {
  return async function saveAccount(
    userId: string,
    id: string,
    input: AccountInputDto,
  ): Promise<SaveAccountResult> {
    return uow.run(async (repos) => {
      const profile = await repos.profiles.findById(userId);
      if (!profile) throw new DomainError('unauthorized');
      if (profile.primaryCurrency === null) throw new DomainError('primary_currency_required');

      const parsed = accountInputSchema.safeParse(input);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          fields[String(issue.path[0] ?? 'body')] ??= issue.message;
        }
        throw new DomainError('validation_error', { fields });
      }
      const values = {
        ...parsed.data,
        initialBalance: normalizeDecimal(parsed.data.initialBalance),
      };
      const updatedAt = new Date(values.updatedAt);
      const archivedAt = values.archivedAt === null ? null : new Date(values.archivedAt);

      const existing = await repos.accounts.findById(id);
      if (existing && existing.userId !== userId) throw new DomainError('not_found');

      if (existing) {
        const current = toAccountRecordDto(existing);
        const incoming = {
          ...values,
          archivedAt: archivedAt?.toISOString() ?? null,
          updatedAt: updatedAt.toISOString(),
        };
        const same = (Object.keys(incoming) as (keyof typeof incoming)[]).every(
          (key) => current[key] === incoming[key],
        );
        const time = existing.updatedAt.getTime();
        if (time === updatedAt.getTime() && same) return { status: 'saved', account: current };
        if (time >= updatedAt.getTime()) return { status: 'conflict', account: current };
      }

      const others = (await repos.accounts.listByUser(userId)).filter((a) => a.id !== id);
      const hasTransactions = existing ? await repos.transactions.existsForAccount(id) : false;
      const errors = checkAccountChange({
        next: {
          id,
          name: values.name,
          currency: values.currency,
          isDefault: values.isDefault,
          archivedAt,
        },
        previous: existing ? ruleView(existing) : null,
        others: others.map(ruleView),
        hasTransactions,
      });
      if (Object.keys(errors).length > 0) {
        throw new DomainError('validation_error', { fields: errors });
      }

      // Marcar una desmarca las demás en la misma transacción: el índice único nunca choca, sin
      // importar en qué orden lleguen los cambios de las dos cuentas (research §9).
      if (values.isDefault) await repos.accounts.clearDefaultExcept(userId, id, updatedAt);

      const account: Account = {
        id,
        userId,
        name: values.name,
        type: values.type,
        currency: values.currency,
        initialBalance: values.initialBalance,
        isDefault: values.isDefault,
        archivedAt,
        createdAt: existing?.createdAt ?? clock.now(),
        updatedAt,
        deletedAt: null,
      };
      await repos.accounts.upsert(account);
      return { status: 'saved', account: toAccountRecordDto(account) };
    });
  };
}
