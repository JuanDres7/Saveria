import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { refreshLedger } from '../src/features/transactions/ledger';
import { transactionService } from '../src/features/transactions/transaction-service';
import {
  makeAccountRecord,
  makeTxRecord,
  resetLedger,
  setupLedger,
  signInWith,
} from './support/ledger';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

import AccountDetail from '../src/app/(app)/accounts/[id]';
import Adjust from '../src/app/(app)/accounts/[id]/adjust';
import Home from '../src/app/(app)/home';
import EditTransaction from '../src/app/(app)/transactions/[id]';
import History from '../src/app/(app)/transactions/index';
import { UndoSnackbar } from '../src/features/transactions/UndoSnackbar';

afterEach(() => {
  resetLedger();
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

/** "Efectivo" con saldo 120.000 (100.000 de saldo inicial + un ingreso de 20.000). */
function setup(initialBalance = '120000') {
  signInWith({ isOnline: false });
  const account = makeAccountRecord({ name: 'Efectivo', isDefault: true, initialBalance });
  return { ...setupLedger([account]), account };
}

async function openAdjust(id: string) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id });
  await render(<Adjust />);
}

describe('historia 6: ajustar el saldo', () => {
  it('6.1 saldo 120.000 y real 115.000 → ajuste de −5.000 y saldo 115.000', async () => {
    const { account, ledger, queue } = setup();
    await openAdjust(account.id);
    expect(screen.getByText('Saldo actual: $ 120.000 COP')).toBeTruthy();

    await type('Saldo real', '115.000');
    expect(screen.getByText('Diferencia: −$ 5.000')).toBeTruthy();
    await fireEvent.press(button('Ajustar saldo'));

    expect(ledger.rows).toHaveLength(1);
    expect(ledger.rows[0]).toMatchObject({
      type: 'adjustment',
      accountId: account.id,
      amount: '-5000',
      currency: 'COP',
      categorySlug: null,
      toAccountId: null,
      syncState: 'pending',
    });
    expect(ledger.balances().get(account.id)).toBe('115000');
    expect(queue.items).toHaveLength(1);
    expect(router.back).toHaveBeenCalled();
  });

  it('un saldo real mayor crea un ajuste positivo', async () => {
    const { account, ledger } = setup();
    await openAdjust(account.id);
    await type('Saldo real', '130.000');
    expect(screen.getByText('Diferencia: $ 10.000')).toBeTruthy();
    await fireEvent.press(button('Ajustar saldo'));
    expect(ledger.rows[0]?.amount).toBe('10000');
    expect(ledger.balances().get(account.id)).toBe('130000');
  });

  it('el saldo real puede ser negativo (sobregiro)', async () => {
    const { account, ledger } = setup();
    await openAdjust(account.id);
    await type('Saldo real', '-20.000');
    await fireEvent.press(button('Ajustar saldo'));
    expect(ledger.balances().get(account.id)).toBe('-20000');
    expect(ledger.rows[0]?.amount).toBe('-140000');
  });

  it('6.2 el ajuste se distingue en el historial, sin categoría, y no cuenta como gasto ni ingreso', async () => {
    const { account, ledger } = setup();
    transactionService.adjustTo(account.id, '115.000');
    refreshLedger();
    await render(<History />);
    expect(screen.getByText('Ajuste de saldo')).toBeTruthy();
    expect(screen.getByText('−$ 5.000')).toBeTruthy();
    expect(ledger.rows.filter((t) => t.type === 'expense' || t.type === 'income')).toHaveLength(0);
    expect(ledger.rows[0]?.categorySlug).toBeNull();
  });

  it('6.3 un saldo real igual al actual no crea ningún ajuste', async () => {
    const { account, ledger, queue } = setup();
    await openAdjust(account.id);
    await type('Saldo real', '120.000');
    expect(screen.getByText('El saldo ya coincide: no se crea ningún ajuste')).toBeTruthy();
    expect(button('Ajustar saldo')).toBeDisabled();
    expect(ledger.rows).toHaveLength(0);
    expect(queue.items).toHaveLength(0);

    // También en el servicio.
    const result = transactionService.adjustTo(account.id, '120000');
    expect(result).toEqual({ ok: true, transaction: null });
    expect(ledger.rows).toHaveLength(0);
  });

  it('un saldo real inválido no crea nada y dice por qué', async () => {
    const { account, ledger } = setup();
    await openAdjust(account.id);
    await type('Saldo real', '12,5');
    expect(screen.getByText('Los montos en COP van sin decimales')).toBeTruthy();
    expect(button('Ajustar saldo')).toBeDisabled();
    expect(ledger.rows).toHaveLength(0);
  });

  it('el ajuste usa los movimientos ya hechos: saldo = inicial + ingresos − gastos', async () => {
    const { account, ledger } = setup('100000');
    ledger.save(
      makeTxRecord(account.id, { type: 'income', categorySlug: 'salary', amount: '50000' }),
    );
    ledger.save(makeTxRecord(account.id, { amount: '30000' }));
    refreshLedger();
    await openAdjust(account.id);
    expect(screen.getByText('Saldo actual: $ 120.000 COP')).toBeTruthy();
    await type('Saldo real', '115000');
    await fireEvent.press(button('Ajustar saldo'));
    expect(ledger.rows.filter((t) => t.type === 'adjustment')[0]?.amount).toBe('-5000');
    // Ningún movimiento anterior cambió.
    expect(ledger.rows.filter((t) => t.type !== 'adjustment')).toHaveLength(2);
  });

  it('6.4 borrarlo devuelve el saldo anterior', async () => {
    const { account, ledger } = setup();
    const created = transactionService.adjustTo(account.id, '115.000');
    if (!created.ok || !created.transaction) throw new Error('no se creó');
    refreshLedger();
    expect(ledger.balances().get(account.id)).toBe('115000');

    jest.mocked(useLocalSearchParams).mockReturnValue({ id: created.transaction.id });
    await render(
      <>
        <EditTransaction />
        <UndoSnackbar />
      </>,
    );
    expect(screen.getByText('Los ajustes no se editan: bórralo y haz uno nuevo.')).toBeTruthy();
    await fireEvent.press(button('Borrar'));
    expect(ledger.balances().get(account.id)).toBe('120000');
  });

  it('Inicio muestra el ajuste con su nombre en los últimos movimientos', async () => {
    const { account } = setup();
    transactionService.adjustTo(account.id, '115.000');
    await render(<Home />);
    expect(screen.getByText('Ajuste de saldo')).toBeTruthy();
  });

  it('el detalle de la cuenta ofrece "Ajustar saldo"', async () => {
    const { account } = setup();
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: account.id });
    await render(<AccountDetail />);
    await fireEvent.press(button('Ajustar saldo'));
    expect(router.push).toHaveBeenCalledWith(`/accounts/${account.id}/adjust`);
  });

  it('un ajuste en dólares usa los decimales de la moneda', async () => {
    signInWith({ isOnline: false });
    const usd = makeAccountRecord({
      name: 'Ahorros USD',
      isDefault: true,
      currency: 'USD',
      initialBalance: '50',
    });
    const { ledger } = setupLedger([usd]);
    const result = transactionService.adjustTo(usd.id, '47,50');
    expect(result.ok).toBe(true);
    expect(ledger.rows[0]).toMatchObject({ amount: '-2.50', currency: 'USD' });
    expect(ledger.balances().get(usd.id)).toBe('47.5');
  });
});
