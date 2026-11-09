import { z } from 'zod';
import { isSupportedCurrency } from '../catalog/currencies';
import { parseAmount } from '../money';
import {
  DESCRIPTION_MAX,
  makeTransactionInputSchema,
  type TransactionInput,
} from '../validation/transaction';

/**
 * Formato de las acciones que propondrá la IA para gastos, ingresos y transferencias
 * (Constitución I y II, research §12). La IA nunca guarda nada: devuelve este mensaje y la
 * pantalla de confirmación lo revisa. Aquí solo se define el formato y su conversión a la misma
 * entrada que arma el formulario manual; la IA en sí llega con la feature 004.
 *
 * El ajuste de saldo no tiene acción de IA: es una corrección del usuario, no algo que se cuente
 * en un relato.
 */

/** Versión del contrato entre el backend y la IA (Constitución VII). */
export const AI_ACTIONS_VERSION = 1;

export const AI_ACTION_TYPES = ['create_expense', 'create_income', 'create_transfer'] as const;
export type AiActionType = (typeof AI_ACTION_TYPES)[number];

/** Datos que la IA pudo adivinar en vez de leerlos del relato (se muestran marcados). */
export const AI_INFERRABLE_FIELDS = [
  'amount',
  'categorySlug',
  'accountId',
  'toAccountId',
  'toAmount',
  'occurredOn',
  'description',
] as const;
export type AiInferrableField = (typeof AI_INFERRABLE_FIELDS)[number];

/**
 * Una acción propuesta. Todo es opcional salvo el tipo, porque el relato puede no traerlo. La IA
 * da el **nombre** de la cuenta, nunca su id interno (`.strict()` rechaza cualquier otro campo).
 */
export const aiActionSchema = z
  .object({
    type: z.enum(AI_ACTION_TYPES),
    amount: z.string().max(32).optional(),
    categorySlug: z.string().max(64).optional(),
    accountName: z.string().max(80).optional(),
    toAccountName: z.string().max(80).optional(),
    toAmount: z.string().max(32).optional(),
    occurredOn: z.string().max(20).optional(),
    description: z.string().max(DESCRIPTION_MAX).optional(),
    inferred: z.array(z.enum(AI_INFERRABLE_FIELDS)).default([]),
  })
  .strict();

export type AiAction = z.input<typeof aiActionSchema>;

/** El mensaje completo: versionado y validado en los dos lados. */
export const aiActionsMessageSchema = z
  .object({
    version: z.literal(AI_ACTIONS_VERSION),
    actions: z.array(aiActionSchema),
  })
  .strict();

export type AiActionsMessage = z.output<typeof aiActionsMessageSchema>;

export type ParseAiActionsResult =
  | { ok: true; message: AiActionsMessage }
  | { ok: false; error: string };

/** Valida un mensaje de la IA (por ejemplo, el JSON que llega del microservicio). */
export function parseAiActions(input: unknown): ParseAiActionsResult {
  const parsed = aiActionsMessageSchema.safeParse(input);
  if (parsed.success) return { ok: true, message: parsed.data };
  const issue = parsed.error.issues[0];
  return {
    ok: false,
    error: `${issue?.path.join('.') || 'mensaje'}: ${issue?.message ?? 'inválido'}`,
  };
}

/** Lo que la conversión necesita saber de una cuenta del usuario. */
export interface AiAccountView {
  id: string;
  name: string;
  currency: string;
  archivedAt: string | Date | null;
}

export interface AiActionContext {
  accounts: readonly AiAccountView[];
  /** La cuenta por defecto: se usa (marcada como inferida) si la IA no nombra una cuenta válida */
  defaultAccountId: string | null;
  /** Hoy como `YYYY-MM-DD`; el teléfono usa su hora local */
  today(): string;
  /** Instante ISO que se usa como `updatedAt` del movimiento */
  now(): string;
}

export type ActionConversion =
  /** Lista para llevar a la pantalla de confirmación o al caso de uso */
  | { status: 'complete'; input: TransactionInput; inferred: AiInferrableField[] }
  /** Falta algo que no se puede suponer: la pantalla de confirmación lo pregunta */
  | { status: 'incomplete'; missing: AiInferrableField[] }
  /** Datos que no cumplen las reglas (las mismas del formulario manual) */
  | { status: 'invalid'; errors: Record<string, string> };

const normalizeName = (name: string) => name.trim().toLocaleLowerCase('es');
const isActive = (account: AiAccountView) => account.archivedAt === null;

/**
 * Convierte una acción de la IA en la **misma entrada** (`TransactionInput`) que arma el
 * formulario manual, para que ambos lleguen al mismo caso de uso (Constitución I).
 *
 * No inventa lo que no se puede suponer: sin monto, sin categoría (en gastos e ingresos), sin
 * cuenta de destino o, entre monedas distintas, sin monto de entrada, devuelve `incomplete` con la
 * lista. Sí completa dos datos con valores razonables y los marca como inferidos (Constitución II):
 * la cuenta (la cuenta por defecto) y la fecha (hoy). Nunca calcula una tasa de cambio.
 */
export function actionToTransactionInput(
  rawAction: AiAction,
  context: AiActionContext,
): ActionConversion {
  const action = aiActionSchema.parse(rawAction);
  const inferred = new Set<AiInferrableField>(action.inferred);
  const missing: AiInferrableField[] = [];
  const activeAccounts = context.accounts.filter(isActive);

  const findByName = (name: string | undefined) =>
    name === undefined
      ? undefined
      : activeAccounts.find((a) => normalizeName(a.name) === normalizeName(name));

  // Cuenta: la nombrada, o la cuenta por defecto marcada como inferida.
  let account = findByName(action.accountName);
  if (!account) {
    account = activeAccounts.find((a) => a.id === context.defaultAccountId);
    if (account) inferred.add('accountId');
  }
  if (!account) return { status: 'incomplete', missing: ['accountId'] };

  const isTransfer = action.type === 'create_transfer';
  const errors: Record<string, string> = {};
  if (!isSupportedCurrency(account.currency)) {
    return { status: 'invalid', errors: { currency: 'Moneda no soportada' } };
  }

  // Monto que sale / del movimiento.
  let amount = '';
  if (action.amount === undefined || action.amount.trim() === '') missing.push('amount');
  else {
    const parsed = parseAmount(action.amount, account.currency);
    if (parsed.ok) amount = parsed.value;
    else errors.amount = parsed.error;
  }

  // Categoría: solo gastos e ingresos; no se inventa.
  if (!isTransfer && action.categorySlug === undefined) missing.push('categorySlug');

  // Destino de una transferencia.
  let target: AiAccountView | undefined;
  let toAmount: string | null = null;
  if (isTransfer) {
    target = findByName(action.toAccountName);
    if (!target) missing.push('toAccountId');
    else if (target.currency === account.currency) toAmount = amount === '' ? null : amount;
    else if (action.toAmount === undefined || action.toAmount.trim() === '') {
      missing.push('toAmount');
    } else {
      const entering = parseAmount(action.toAmount, target.currency);
      if (entering.ok) toAmount = entering.value;
      else errors.toAmount = entering.error;
    }
  }

  if (missing.length > 0) return { status: 'incomplete', missing };
  if (Object.keys(errors).length > 0) return { status: 'invalid', errors };

  // Fecha: la del relato, o hoy marcada como inferida.
  let occurredOn = action.occurredOn;
  if (occurredOn === undefined) {
    occurredOn = context.today();
    inferred.add('occurredOn');
  }

  const type =
    action.type === 'create_expense'
      ? 'expense'
      : action.type === 'create_income'
        ? 'income'
        : 'transfer';
  const input: TransactionInput = {
    type,
    accountId: account.id,
    amount,
    currency: account.currency,
    toAccountId: isTransfer ? (target?.id ?? null) : null,
    toAmount: isTransfer ? toAmount : null,
    toCurrency:
      isTransfer && target && isSupportedCurrency(target.currency) ? target.currency : null,
    // En una transferencia no hay categoría: si la IA manda una, la validación la rechaza.
    categorySlug: action.categorySlug ?? null,
    description: action.description?.trim() ? action.description.trim() : null,
    occurredOn,
    deletedAt: null,
    updatedAt: context.now(),
  };

  // Las mismas reglas que el formulario manual (categoría del tipo correcto, fecha, decimales…).
  const schema = makeTransactionInputSchema({ today: context.today });
  const validated = schema.safeParse(input);
  if (!validated.success) {
    for (const issue of validated.error.issues) {
      errors[String(issue.path[0] ?? 'body')] ??= issue.message;
    }
    return { status: 'invalid', errors };
  }
  return { status: 'complete', input: validated.data, inferred: [...inferred] };
}
