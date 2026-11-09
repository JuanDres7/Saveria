import { z } from 'zod';
import { isCategoryOfType } from '../catalog/categories';
import { isSupportedCurrency } from '../catalog/currencies';
import { amountTextError, toE4 } from '../money';

export const TRANSACTION_TYPES = ['expense', 'income', 'transfer', 'adjustment'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const DESCRIPTION_MAX = 120;

/** Hoy en la zona horaria del teléfono, como `YYYY-MM-DD` (FR-007). */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Hoy en UTC, como `YYYY-MM-DD` (lo usa el servidor). */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isRealDate(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

export interface TransactionSchemaOptions {
  /** Hoy como `YYYY-MM-DD`. El teléfono usa su hora local; el servidor, UTC. */
  today: () => string;
  /** Días de tolerancia hacia el futuro por zonas horarias (el servidor usa 1; research §8). */
  toleranceDays?: number;
}

const optionalDescription = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX, `Máximo ${DESCRIPTION_MAX} caracteres`)
  .nullable()
  .transform((value) => (value === '' ? null : value));

/**
 * Un movimiento tal como lo envía el teléfono (`PUT /v1/transactions/{id}`), con las reglas por
 * tipo de data-model.md. Que la moneda coincida con la de la cuenta se comprueba en el caso de uso,
 * que conoce las cuentas.
 */
export function makeTransactionInputSchema({ today, toleranceDays = 0 }: TransactionSchemaOptions) {
  return z
    .object({
      type: z.enum(TRANSACTION_TYPES, 'Tipo de movimiento no válido'),
      accountId: z.uuid('Cuenta no válida'),
      amount: z.string(),
      currency: z.string().refine(isSupportedCurrency, 'Moneda no soportada'),
      toAccountId: z.uuid('Cuenta no válida').nullable(),
      toAmount: z.string().nullable(),
      toCurrency: z.string().nullable(),
      categorySlug: z.string().nullable(),
      description: optionalDescription,
      occurredOn: z.string(),
      deletedAt: z.iso.datetime({ offset: true }).nullable(),
      updatedAt: z.iso.datetime({ offset: true }),
    })
    .superRefine((tx, ctx) => {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });

      if (!isRealDate(tx.occurredOn)) {
        issue('occurredOn', 'Fecha inválida');
      } else if (tx.occurredOn > addDays(today(), toleranceDays)) {
        issue('occurredOn', 'La fecha no puede ser futura');
      }

      if (isSupportedCurrency(tx.currency)) {
        const error = amountTextError(tx.amount, tx.currency, {
          allowNegative: tx.type === 'adjustment',
        });
        if (error) issue('amount', error);
      }

      const isTransfer = tx.type === 'transfer';
      if (!isTransfer) {
        if (tx.toAccountId !== null) issue('toAccountId', 'Solo una transferencia tiene destino');
        if (tx.toAmount !== null)
          issue('toAmount', 'Solo una transferencia tiene monto de entrada');
        if (tx.toCurrency !== null)
          issue('toCurrency', 'Solo una transferencia tiene moneda de entrada');
      }

      if (tx.type === 'expense' || tx.type === 'income') {
        if (tx.categorySlug === null) issue('categorySlug', 'Elige una categoría');
        else if (!isCategoryOfType(tx.categorySlug, tx.type)) {
          issue(
            'categorySlug',
            tx.type === 'expense'
              ? 'Esa categoría no es de gasto'
              : 'Esa categoría no es de ingreso',
          );
        }
        return;
      }

      if (tx.categorySlug !== null) {
        issue(
          'categorySlug',
          isTransfer ? 'Una transferencia no lleva categoría' : 'Un ajuste no lleva categoría',
        );
      }
      if (!isTransfer) return;

      if (tx.toAccountId === null) issue('toAccountId', 'Elige la cuenta de destino');
      else if (tx.toAccountId === tx.accountId) {
        issue('toAccountId', 'La cuenta de destino debe ser distinta a la de origen');
      }
      if (tx.toCurrency === null || !isSupportedCurrency(tx.toCurrency)) {
        issue('toCurrency', 'Moneda de destino no válida');
        return;
      }
      if (tx.toAmount === null) {
        issue('toAmount', 'Escribe el monto que entra');
        return;
      }
      const toError = amountTextError(tx.toAmount, tx.toCurrency);
      if (toError) {
        issue('toAmount', toError);
        return;
      }
      if (
        tx.toCurrency === tx.currency &&
        amountTextError(tx.amount, tx.currency) === null &&
        toE4(tx.toAmount) !== toE4(tx.amount)
      ) {
        issue('toAmount', 'Con la misma moneda, el monto que entra es igual al que sale');
      }
    });
}

/** Esquema con el "hoy" local del dispositivo y sin tolerancia (la app). */
export const transactionInputSchema = makeTransactionInputSchema({ today: () => localToday() });

export type TransactionInput = z.infer<ReturnType<typeof makeTransactionInputSchema>>;
