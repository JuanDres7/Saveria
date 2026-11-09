import { z } from 'zod';
import { isSupportedCurrency } from '../catalog/currencies';
import { amountTextError } from '../money';

export const ACCOUNT_TYPES = ['cash', 'wallet', 'bank'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_NAME_MAX = 40;

/**
 * Datos de una cuenta tal como los envía el teléfono (`PUT /v1/accounts/{id}`). Las reglas que
 * dependen de las demás cuentas del usuario están en `rules/accounts.ts`.
 */
export const accountInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Escribe un nombre para la cuenta')
      .max(ACCOUNT_NAME_MAX, `Máximo ${ACCOUNT_NAME_MAX} caracteres`),
    type: z.enum(ACCOUNT_TYPES, 'Tipo de cuenta no válido'),
    currency: z.string().refine(isSupportedCurrency, 'Moneda no soportada'),
    initialBalance: z.string(),
    isDefault: z.boolean(),
    archivedAt: z.iso.datetime({ offset: true }).nullable(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .superRefine((account, ctx) => {
    if (!isSupportedCurrency(account.currency)) return;
    const error = amountTextError(account.initialBalance, account.currency, {
      allowNegative: true,
      allowZero: true,
    });
    if (error) ctx.addIssue({ code: 'custom', path: ['initialBalance'], message: error });
  });

export type AccountInput = z.infer<typeof accountInputSchema>;
