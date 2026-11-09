import { describe, expect, it } from 'bun:test';
import {
  type AiAction,
  actionToTransactionInput,
  parseAiActions,
  transactionInputSchema,
} from '../src';

const TODAY = '2026-10-28';
const NOW = '2026-10-28T15:00:00.000Z';

const EFECTIVO = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Efectivo',
  currency: 'COP',
  archivedAt: null,
};
const NEQUI = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Nequi',
  currency: 'COP',
  archivedAt: null,
};
const USD = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Ahorros USD',
  currency: 'USD',
  archivedAt: null,
};
const VIEJA = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Vieja',
  currency: 'COP',
  archivedAt: '2026-10-01T00:00:00.000Z',
};

const context = {
  accounts: [EFECTIVO, NEQUI, USD, VIEJA],
  defaultAccountId: EFECTIVO.id,
  today: () => TODAY,
  now: () => NOW,
};

const expense = (over: Partial<AiAction> = {}): AiAction => ({
  type: 'create_expense',
  amount: '18000',
  categorySlug: 'dining',
  accountName: 'Nequi',
  occurredOn: TODAY,
  description: 'almuerzo',
  inferred: [],
  ...over,
});

describe('acciones de la IA: create_expense / create_income', () => {
  it('una acción completa se convierte en el mismo TransactionInput que arma el formulario', () => {
    const result = actionToTransactionInput(expense(), context);
    expect(result).toEqual({
      status: 'complete',
      input: {
        type: 'expense',
        accountId: NEQUI.id,
        amount: '18000',
        currency: 'COP',
        toAccountId: null,
        toAmount: null,
        toCurrency: null,
        categorySlug: 'dining',
        description: 'almuerzo',
        occurredOn: TODAY,
        deletedAt: null,
        updatedAt: NOW,
      },
      inferred: [],
    });
    // Es una entrada válida del caso de uso: el formulario y la IA llegan al mismo lugar.
    if (result.status === 'complete') {
      expect(transactionInputSchema.safeParse(result.input).success).toBe(true);
    }
  });

  it('un create_income se convierte igual, con una categoría de ingreso', () => {
    const result = actionToTransactionInput(
      expense({ type: 'create_income', categorySlug: 'salary', accountName: 'Efectivo' }),
      context,
    );
    expect(result.status).toBe('complete');
    if (result.status === 'complete') expect(result.input).toMatchObject({ type: 'income' });
  });

  it('la cuenta se busca por nombre sin distinguir mayúsculas ni espacios', () => {
    const result = actionToTransactionInput(expense({ accountName: '  nequi ' }), context);
    expect(result.status === 'complete' && result.input.accountId).toBe(NEQUI.id);
  });

  it('un accountName desconocido usa la cuenta por defecto y la marca como inferida', () => {
    const result = actionToTransactionInput(expense({ accountName: 'Bancolombia' }), context);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(result.input.accountId).toBe(EFECTIVO.id);
      expect(result.inferred).toContain('accountId');
    }
  });

  it('sin accountName usa la cuenta por defecto y la marca como inferida', () => {
    const { accountName: _omit, ...withoutName } = expense();
    const result = actionToTransactionInput(withoutName, context);
    expect(result.status === 'complete' && result.inferred).toContain('accountId');
  });

  it('una cuenta archivada no se elige por nombre: cae en la cuenta por defecto', () => {
    const result = actionToTransactionInput(expense({ accountName: 'Vieja' }), context);
    expect(result.status === 'complete' && result.input.accountId).toBe(EFECTIVO.id);
  });

  it('sin occurredOn pone la fecha de hoy y la marca como inferida', () => {
    const { occurredOn: _omit, ...withoutDate } = expense();
    const result = actionToTransactionInput(withoutDate, context);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(result.input.occurredOn).toBe(TODAY);
      expect(result.inferred).toContain('occurredOn');
    }
  });

  it('conserva lo que la IA ya marcó como inferido', () => {
    const result = actionToTransactionInput(expense({ inferred: ['amount'] }), context);
    expect(result.status === 'complete' && result.inferred).toContain('amount');
  });

  it('sin amount no inventa nada: devuelve incomplete con lo que falta', () => {
    const { amount: _omit, ...withoutAmount } = expense();
    expect(actionToTransactionInput(withoutAmount, context)).toEqual({
      status: 'incomplete',
      missing: ['amount'],
    });
  });

  it('sin categoría tampoco la inventa', () => {
    const { categorySlug: _omit, ...withoutCategory } = expense();
    expect(actionToTransactionInput(withoutCategory, context)).toEqual({
      status: 'incomplete',
      missing: ['categorySlug'],
    });
  });

  it('una categoría de ingreso en un create_expense se rechaza igual que en el formulario', () => {
    const result = actionToTransactionInput(expense({ categorySlug: 'salary' }), context);
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') expect(result.errors.categorySlug).toBeDefined();
  });

  it('un monto con decimales que la moneda no permite se rechaza', () => {
    const result = actionToTransactionInput(expense({ amount: '18000.5' }), context);
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') expect(result.errors.amount).toBeDefined();
  });

  it('un monto negativo se rechaza', () => {
    const result = actionToTransactionInput(expense({ amount: '-18000' }), context);
    expect(result.status).toBe('invalid');
  });

  it('sin cuentas activas ni cuenta por defecto no puede elegir cuenta', () => {
    const result = actionToTransactionInput(expense({ accountName: 'Otra' }), {
      ...context,
      accounts: [VIEJA],
    });
    expect(result).toEqual({ status: 'incomplete', missing: ['accountId'] });
  });
});

describe('acciones de la IA: create_transfer', () => {
  const transfer = (over: Partial<AiAction> = {}): AiAction => ({
    type: 'create_transfer',
    amount: '100000',
    accountName: 'Efectivo',
    toAccountName: 'Nequi',
    occurredOn: TODAY,
    inferred: [],
    ...over,
  });

  it('con la misma moneda el monto que entra es el que sale', () => {
    const result = actionToTransactionInput(transfer(), context);
    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(result.input).toMatchObject({
        type: 'transfer',
        accountId: EFECTIVO.id,
        toAccountId: NEQUI.id,
        amount: '100000',
        toAmount: '100000',
        toCurrency: 'COP',
        categorySlug: null,
      });
    }
  });

  it('sin cuenta de destino no la inventa: incomplete', () => {
    const { toAccountName: _omit, ...withoutTarget } = transfer();
    expect(actionToTransactionInput(withoutTarget, context)).toEqual({
      status: 'incomplete',
      missing: ['toAccountId'],
    });
  });

  it('una cuenta de destino desconocida tampoco se inventa', () => {
    expect(actionToTransactionInput(transfer({ toAccountName: 'Nadie' }), context)).toEqual({
      status: 'incomplete',
      missing: ['toAccountId'],
    });
  });

  it('entre COP y USD conserva los dos montos, sin calcular tasa', () => {
    const result = actionToTransactionInput(
      transfer({ amount: '40000', toAccountName: 'Ahorros USD', toAmount: '10' }),
      context,
    );
    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(result.input).toMatchObject({
        amount: '40000',
        currency: 'COP',
        toAmount: '10.00',
        toCurrency: 'USD',
      });
    }
  });

  it('entre monedas distintas sin el monto que entra → incomplete (no calcula tasa)', () => {
    expect(actionToTransactionInput(transfer({ toAccountName: 'Ahorros USD' }), context)).toEqual({
      status: 'incomplete',
      missing: ['toAmount'],
    });
  });

  it('la misma cuenta de origen y destino se rechaza', () => {
    const result = actionToTransactionInput(transfer({ toAccountName: 'Efectivo' }), context);
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') expect(result.errors.toAccountId).toBeDefined();
  });

  it('con categoría se rechaza', () => {
    const result = actionToTransactionInput(transfer({ categorySlug: 'dining' }), context);
    expect(result.status).toBe('invalid');
  });
});

describe('mensaje de la IA: parseAiActions (versionado y validado)', () => {
  it('acepta un mensaje con version 1 y acciones', () => {
    const result = parseAiActions({ version: 1, actions: [expense()] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message.actions).toHaveLength(1);
  });

  it('los datos opcionales pueden faltar y inferred queda vacío', () => {
    const result = parseAiActions({ version: 1, actions: [{ type: 'create_expense' }] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message.actions[0]?.inferred).toEqual([]);
  });

  it('un mensaje sin version se rechaza', () => {
    expect(parseAiActions({ actions: [expense()] }).ok).toBe(false);
  });

  it('otra versión se rechaza', () => {
    expect(parseAiActions({ version: 2, actions: [expense()] }).ok).toBe(false);
  });

  it('un tipo de acción desconocido se rechaza', () => {
    expect(parseAiActions({ version: 1, actions: [{ type: 'create_debt' }] }).ok).toBe(false);
  });

  it('el ajuste de saldo no tiene acción de IA', () => {
    expect(parseAiActions({ version: 1, actions: [{ type: 'create_adjustment' }] }).ok).toBe(false);
  });

  it('la IA da el nombre de la cuenta, nunca un id interno: un campo accountId se rechaza', () => {
    const result = parseAiActions({
      version: 1,
      actions: [{ ...expense(), accountId: EFECTIVO.id }],
    });
    expect(result.ok).toBe(false);
  });

  it('un campo inferido desconocido se rechaza', () => {
    expect(
      parseAiActions({ version: 1, actions: [expense({ inferred: ['inventado' as never] })] }).ok,
    ).toBe(false);
  });
});
