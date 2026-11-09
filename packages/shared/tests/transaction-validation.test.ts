import { describe, expect, it } from 'bun:test';
import { makeTransactionInputSchema } from '../src';

const schema = makeTransactionInputSchema({ today: () => '2026-10-28' });

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const expense = {
  type: 'expense',
  accountId: ACCOUNT,
  amount: '18000',
  currency: 'COP',
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
  categorySlug: 'dining',
  description: null,
  occurredOn: '2026-10-28',
  deletedAt: null,
  updatedAt: '2026-10-28T12:00:00.000Z',
};

const transfer = {
  ...expense,
  type: 'transfer',
  categorySlug: null,
  toAccountId: OTHER,
  toAmount: '18000',
  toCurrency: 'COP',
};

const adjustment = { ...expense, type: 'adjustment', categorySlug: null, amount: '-5000' };

const fieldsOf = (input: unknown) => {
  const parsed = schema.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((i) => String(i.path[0]));
};

describe('transactionInputSchema: gastos e ingresos', () => {
  it('acepta un gasto y un ingreso válidos', () => {
    expect(fieldsOf(expense)).toEqual([]);
    expect(fieldsOf({ ...expense, type: 'income', categorySlug: 'salary' })).toEqual([]);
  });

  it('1.5 monto 0 o negativo no se acepta', () => {
    expect(fieldsOf({ ...expense, amount: '0' })).toContain('amount');
    expect(fieldsOf({ ...expense, amount: '-18000' })).toContain('amount');
  });

  it('1.6 los decimales dependen de la moneda', () => {
    expect(fieldsOf({ ...expense, amount: '18000.5' })).toContain('amount');
    expect(fieldsOf({ ...expense, currency: 'USD', amount: '12.50' })).toEqual([]);
  });

  it('1.5 sin categoría o con una del otro tipo no se acepta', () => {
    expect(fieldsOf({ ...expense, categorySlug: null })).toContain('categorySlug');
    expect(fieldsOf({ ...expense, categorySlug: 'salary' })).toContain('categorySlug');
    expect(fieldsOf({ ...expense, type: 'income', categorySlug: 'dining' })).toContain(
      'categorySlug',
    );
  });

  it('un gasto no lleva campos de transferencia', () => {
    expect(fieldsOf({ ...expense, toAccountId: OTHER })).toContain('toAccountId');
  });

  it('la descripción tiene máximo 120 caracteres y vacía queda en null', () => {
    expect(fieldsOf({ ...expense, description: 'x'.repeat(121) })).toContain('description');
    expect(schema.parse({ ...expense, description: '   ' }).description).toBeNull();
  });

  it('FR-007 la fecha es hoy o pasada, nunca futura', () => {
    expect(fieldsOf({ ...expense, occurredOn: '2020-01-01' })).toEqual([]);
    expect(fieldsOf({ ...expense, occurredOn: '2026-10-29' })).toContain('occurredOn');
    expect(fieldsOf({ ...expense, occurredOn: '2026-02-30' })).toContain('occurredOn');
  });

  it('con tolerancia de 1 día (servidor) acepta mañana pero no pasado mañana', () => {
    const server = makeTransactionInputSchema({ today: () => '2026-10-28', toleranceDays: 1 });
    expect(server.safeParse({ ...expense, occurredOn: '2026-10-29' }).success).toBe(true);
    expect(server.safeParse({ ...expense, occurredOn: '2026-10-30' }).success).toBe(false);
  });
});

describe('transactionInputSchema: transferencias', () => {
  it('acepta una transferencia válida, también entre monedas', () => {
    expect(fieldsOf(transfer)).toEqual([]);
    expect(fieldsOf({ ...transfer, currency: 'USD', amount: '10.00', toAmount: '40000' })).toEqual(
      [],
    );
  });

  it('5.4 origen y destino deben ser distintos', () => {
    expect(fieldsOf({ ...transfer, toAccountId: ACCOUNT })).toContain('toAccountId');
  });

  it('5.2 no lleva categoría', () => {
    expect(fieldsOf({ ...transfer, categorySlug: 'dining' })).toContain('categorySlug');
  });

  it('exige destino, monto que entra y su moneda', () => {
    expect(fieldsOf({ ...transfer, toAccountId: null })).toContain('toAccountId');
    expect(fieldsOf({ ...transfer, toAmount: null })).toContain('toAmount');
    expect(fieldsOf({ ...transfer, toCurrency: null })).toContain('toCurrency');
    expect(fieldsOf({ ...transfer, toAmount: '0' })).toContain('toAmount');
  });

  it('con la misma moneda, el monto que entra es igual al que sale', () => {
    expect(fieldsOf({ ...transfer, toAmount: '17000' })).toContain('toAmount');
  });
});

describe('transactionInputSchema: ajustes', () => {
  it('acepta ajustes positivos y negativos', () => {
    expect(fieldsOf(adjustment)).toEqual([]);
    expect(fieldsOf({ ...adjustment, amount: '5000' })).toEqual([]);
  });

  it('6.3 un ajuste de 0 no se acepta', () => {
    expect(fieldsOf({ ...adjustment, amount: '0' })).toContain('amount');
  });

  it('no lleva categoría ni campos de transferencia', () => {
    expect(fieldsOf({ ...adjustment, categorySlug: 'dining' })).toContain('categorySlug');
    expect(fieldsOf({ ...adjustment, toAccountId: OTHER })).toContain('toAccountId');
  });
});
