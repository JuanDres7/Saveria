import { actionToTransactionInput, localToday } from '@saveria/shared';
import { transactionService } from '../src/features/transactions/transaction-service';
import { makeAccountRecord, resetLedger, setupLedger, signInWith } from './support/ledger';

afterEach(() => resetLedger());

/**
 * Constitución I: el formulario manual y la IA terminan en la misma entrada. Lo que guarda el
 * formulario es exactamente lo que produce la conversión de una acción de la IA equivalente.
 */
describe('la IA y el formulario manual producen la misma entrada', () => {
  function setup() {
    signInWith({ isOnline: false });
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const nequi = makeAccountRecord({ name: 'Nequi' });
    const usd = makeAccountRecord({ name: 'Ahorros USD', currency: 'USD' });
    const ctx = setupLedger([efectivo, nequi, usd]);
    const context = {
      accounts: [efectivo, nequi, usd],
      defaultAccountId: efectivo.id,
      today: () => localToday(),
      now: () => '2026-11-09T12:00:00.000Z',
    };
    return { ...ctx, efectivo, nequi, usd, context };
  }

  /** El movimiento guardado, sin lo que solo conoce la base local. */
  const payloadOf = (row: Record<string, unknown>) => {
    const { id: _id, createdAt: _c, syncState: _s, syncError: _e, updatedAt: _u, ...rest } = row;
    return rest;
  };

  it('un gasto', () => {
    const { ledger, nequi, context } = setup();
    const saved = transactionService.record({
      type: 'expense',
      amountText: '18.000',
      accountId: nequi.id,
      categorySlug: 'dining',
      occurredOn: localToday(),
      description: 'almuerzo',
    });
    if (!saved.ok) throw new Error('no se guardó');

    const fromAi = actionToTransactionInput(
      {
        type: 'create_expense',
        amount: '18000',
        categorySlug: 'dining',
        accountName: 'Nequi',
        occurredOn: localToday(),
        description: 'almuerzo',
      },
      context,
    );
    expect(fromAi.status).toBe('complete');
    if (fromAi.status === 'complete') {
      const { updatedAt: _u, ...aiInput } = fromAi.input;
      expect(aiInput).toEqual(payloadOf(ledger.rows[0] as unknown as Record<string, unknown>));
    }
  });

  it('una transferencia entre monedas', () => {
    const { ledger, efectivo, usd, context } = setup();
    const saved = transactionService.transfer({
      fromAccountId: efectivo.id,
      toAccountId: usd.id,
      amountText: '40.000',
      toAmountText: '10',
      occurredOn: localToday(),
      description: '',
    });
    if (!saved.ok) throw new Error('no se guardó');

    const fromAi = actionToTransactionInput(
      {
        type: 'create_transfer',
        amount: '40000',
        accountName: 'Efectivo',
        toAccountName: 'Ahorros USD',
        toAmount: '10',
        occurredOn: localToday(),
      },
      context,
    );
    expect(fromAi.status).toBe('complete');
    if (fromAi.status === 'complete') {
      const { updatedAt: _u, ...aiInput } = fromAi.input;
      expect(aiInput).toEqual(payloadOf(ledger.rows[0] as unknown as Record<string, unknown>));
    }
  });
});
