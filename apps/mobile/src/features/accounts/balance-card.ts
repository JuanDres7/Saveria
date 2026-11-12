import type { AccountBalance } from '../transactions/ledger';

/** Lo que muestra la tarjeta grande de balance de Inicio (FR-012). */
export type BalanceCardData =
  | {
      /** Todas las cuentas activas están en la moneda principal: se muestra el total */
      kind: 'total';
      amount: string;
      currency: string;
      accountCount: number;
    }
  | {
      /** Si no, el saldo de la cuenta por defecto, diciendo de qué cuenta es */
      kind: 'account';
      name: string;
      currency: string;
      balance: string;
      negative: boolean;
      /** Hay cuentas activas en otra moneda: por eso no hay total */
      otherCurrencies: boolean;
    };

/** La cuenta por defecto del perfil, para cuando la base local todavía no tiene cuentas. */
export interface ProfileDefaultAccount {
  id: string;
  name: string;
  currency: string;
  initialBalance: string;
}

/**
 * Elige qué mostrar en la tarjeta de balance. El total solo sale cuando todas las cuentas activas
 * están en la moneda principal (regla de la feature 002, Constitución IV: nunca se mezclan monedas);
 * si no, sale el saldo de la cuenta por defecto. Las cuentas archivadas no suman ni cuentan.
 */
export function selectBalanceCard(
  summary: { active: readonly AccountBalance[]; total: string | null },
  primaryCurrency: string | null,
  profileDefault: ProfileDefaultAccount | null,
): BalanceCardData | null {
  if (summary.total !== null && primaryCurrency) {
    return {
      kind: 'total',
      amount: summary.total,
      currency: primaryCurrency,
      accountCount: summary.active.length,
    };
  }
  const chosen = summary.active.find((a) => a.account.isDefault) ?? summary.active[0];
  if (chosen) {
    return {
      kind: 'account',
      name: chosen.account.name,
      currency: chosen.account.currency,
      balance: chosen.balance,
      negative: chosen.negative,
      otherCurrencies: summary.active.some((a) => a.account.currency !== chosen.account.currency),
    };
  }
  // Recién terminado el onboarding, la base local puede no tener todavía "Efectivo".
  if (profileDefault) {
    return {
      kind: 'account',
      name: profileDefault.name,
      currency: profileDefault.currency,
      balance: profileDefault.initialBalance,
      negative: false,
      otherCurrencies: false,
    };
  }
  return null;
}
