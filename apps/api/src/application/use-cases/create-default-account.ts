import type { Account } from '../../domain/entities';
import type { AccountRepository } from '../ports/repositories';

export const DEFAULT_ACCOUNT_NAME = 'Efectivo';

/**
 * Crea la cuenta "Efectivo" (FR-016) con el id que generó el cliente. Recibe el repositorio para
 * correr dentro de la transacción de quien la llama; la feature 002 la reutiliza.
 */
export async function createDefaultAccount(
  accounts: AccountRepository,
  { id, userId, currency, now }: { id: string; userId: string; currency: string; now: Date },
): Promise<Account> {
  const account: Account = {
    id,
    userId,
    name: DEFAULT_ACCOUNT_NAME,
    currency,
    initialBalance: '0',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await accounts.create(account);
  return account;
}
