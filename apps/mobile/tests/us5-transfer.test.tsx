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

import Home from '../src/app/(app)/home';
import EditTransaction from '../src/app/(app)/transactions/[id]';
import History from '../src/app/(app)/transactions/index';
import Transfer from '../src/app/(app)/transfer';
import { UndoSnackbar } from '../src/features/transactions/UndoSnackbar';

afterEach(() => {
  resetLedger();
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

const efectivo = () =>
  makeAccountRecord({ name: 'Efectivo', isDefault: true, initialBalance: '300000' });
const nequi = () => makeAccountRecord({ name: 'Nequi', type: 'wallet' });
const usd = () => makeAccountRecord({ name: 'Ahorros USD', currency: 'USD', initialBalance: '50' });

/** Las cuentas de la prueba, con "Efectivo" como origen por defecto. */
function setup(isOnline = false) {
  signInWith({ isOnline });
  const a = efectivo();
  const b = nequi();
  const c = usd();
  return { ...setupLedger([a, b, c]), efectivo: a, nequi: b, usd: c };
}

/** Una transferencia ya guardada de 100.000 de Efectivo a Nequi. */
function savedTransfer(ctx: ReturnType<typeof setup>) {
  const tx = makeTxRecord(ctx.efectivo.id, {
    type: 'transfer',
    categorySlug: null,
    amount: '100000',
    toAccountId: ctx.nequi.id,
    toAmount: '100000',
    toCurrency: 'COP',
  });
  ctx.ledger.save(tx);
  refreshLedger();
  return tx;
}

describe('historia 5: transferir entre cuentas', () => {
  it('5.2 no pide categoría', async () => {
    setup();
    await render(<Transfer />);
    expect(screen.queryByText('Categoría')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Mercado' })).toBeNull();
  });

  it('5.1 100.000 COP de Efectivo a Nequi: una baja, la otra sube', async () => {
    const ctx = setup();
    await render(<Transfer />);
    expect(radio('Efectivo')).toBeChecked(); // origen: la cuenta por defecto
    await fireEvent.press(radio('Hacia Nequi'));
    await type('Monto', '100.000');
    await fireEvent.press(button('Transferir'));

    expect(ctx.ledger.rows).toHaveLength(1);
    expect(ctx.ledger.rows[0]).toMatchObject({
      type: 'transfer',
      accountId: ctx.efectivo.id,
      toAccountId: ctx.nequi.id,
      amount: '100000',
      toAmount: '100000',
      toCurrency: 'COP',
      categorySlug: null,
      syncState: 'pending',
    });
    expect(ctx.ledger.balances().get(ctx.efectivo.id)).toBe('200000');
    expect(ctx.ledger.balances().get(ctx.nequi.id)).toBe('100000');
    expect(router.back).toHaveBeenCalled();
  });

  it('5.2 no cuenta como gasto ni ingreso: los saldos de Inicio cambian pero no hay categoría', async () => {
    const ctx = setup();
    savedTransfer(ctx);
    await render(<Home />);
    expect(screen.getByText('Transferencia')).toBeTruthy();
    expect(screen.getByText(/Efectivo → Nequi/)).toBeTruthy();
    expect(ctx.ledger.rows.filter((t) => t.type !== 'transfer')).toHaveLength(0);
  });

  it('5.3 con monedas distintas pide el monto que sale y el que entra', async () => {
    const ctx = setup();
    await render(<Transfer />);
    // Mismo tipo de moneda: no hay segundo monto.
    await fireEvent.press(radio('Hacia Nequi'));
    expect(screen.queryByLabelText('Monto que entra (USD)')).toBeNull();

    await fireEvent.press(radio('Hacia Ahorros USD'));
    expect(screen.getByText('Cada cuenta usa su moneda: no se calcula ninguna tasa')).toBeTruthy();
    await type('Monto que sale (COP)', '40.000');
    await type('Monto que entra (USD)', '10,50');
    await fireEvent.press(button('Transferir'));

    expect(ctx.ledger.rows[0]).toMatchObject({
      accountId: ctx.efectivo.id,
      currency: 'COP',
      amount: '40000',
      toAccountId: ctx.usd.id,
      toCurrency: 'USD',
      toAmount: '10.50',
    });
    expect(ctx.ledger.balances().get(ctx.usd.id)).toBe('60.5');
  });

  it('5.3 sin el monto que entra no se guarda', async () => {
    const ctx = setup();
    await render(<Transfer />);
    await fireEvent.press(radio('Hacia Ahorros USD'));
    await type('Monto que sale (COP)', '40.000');
    await fireEvent.press(button('Transferir'));
    expect(screen.getByText('Escribe un monto')).toBeTruthy();
    expect(ctx.ledger.rows).toHaveLength(0);
  });

  it('5.4 no deja elegir la misma cuenta como origen y destino', async () => {
    const ctx = setup();
    await render(<Transfer />);
    // El destino no ofrece la cuenta de origen.
    expect(screen.queryByRole('radio', { name: 'Hacia Efectivo' })).toBeNull();
    await fireEvent.press(radio('Hacia Nequi'));
    // Si el origen pasa a ser la cuenta que estaba de destino, el destino se vacía.
    await fireEvent.press(radio('Nequi'));
    expect(screen.queryByRole('radio', { name: 'Hacia Nequi' })).toBeNull();
    await type('Monto', '1.000');
    await fireEvent.press(button('Transferir'));
    expect(screen.getByText('Elige la cuenta de destino')).toBeTruthy();
    expect(ctx.ledger.rows).toHaveLength(0);
  });

  it('5.4 el servicio también rechaza la misma cuenta', async () => {
    const ctx = setup();
    const result = transactionService.transfer({
      fromAccountId: ctx.efectivo.id,
      toAccountId: ctx.efectivo.id,
      amountText: '1.000',
      toAmountText: '',
      occurredOn: '2026-10-28',
      description: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.toAccountId).toBe(
        'La cuenta de destino debe ser distinta a la de origen',
      );
    }
  });

  it('5.1 y 2.3 aparece una sola vez en el historial general y en el filtro de cada cuenta', async () => {
    const ctx = setup();
    savedTransfer(ctx);
    await render(<History />);
    expect(screen.getAllByText('Transferencia')).toHaveLength(1);

    await fireEvent.press(screen.getByRole('radio', { name: 'Efectivo' }));
    expect(screen.getAllByText('Transferencia')).toHaveLength(1);
    expect(screen.getByText('−$ 100.000')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Nequi' }));
    expect(screen.getAllByText('Transferencia')).toHaveLength(1);
    expect(screen.getByText('+$ 100.000')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Ahorros USD' }));
    expect(screen.queryByText('Transferencia')).toBeNull();
  });

  it('5.5 editar el monto cambia los dos saldos juntos', async () => {
    const ctx = setup();
    const tx = savedTransfer(ctx);
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: tx.id });
    await render(<EditTransaction />);
    expect(screen.getByLabelText('Monto').props.value).toBe('100000');

    await type('Monto', '150.000');
    await fireEvent.press(button('Guardar cambios'));

    expect(ctx.ledger.findById(tx.id)).toMatchObject({ amount: '150000', toAmount: '150000' });
    expect(ctx.ledger.balances().get(ctx.efectivo.id)).toBe('150000');
    expect(ctx.ledger.balances().get(ctx.nequi.id)).toBe('150000');
    // Un solo cambio pendiente con la fila completa: nunca queda una mitad sin la otra.
    expect(ctx.queue.items).toHaveLength(1);
    expect(ctx.queue.items[0]).toMatchObject({ entity: 'transaction', operation: 'upsert' });
  });

  it('5.5 borrarla devuelve los dos saldos a la vez y "Deshacer" los vuelve a mover', async () => {
    const ctx = setup();
    const tx = savedTransfer(ctx);
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: tx.id });
    await render(
      <>
        <EditTransaction />
        <UndoSnackbar />
      </>,
    );
    await fireEvent.press(button('Borrar'));
    expect(ctx.ledger.balances().get(ctx.efectivo.id)).toBe('300000');
    expect(ctx.ledger.balances().get(ctx.nequi.id)).toBe('0');

    await fireEvent.press(button('Deshacer'));
    expect(ctx.ledger.balances().get(ctx.efectivo.id)).toBe('200000');
    expect(ctx.ledger.balances().get(ctx.nequi.id)).toBe('100000');
  });

  it('una transferencia entre monedas se edita con sus dos montos', async () => {
    const ctx = setup();
    const tx = makeTxRecord(ctx.efectivo.id, {
      type: 'transfer',
      categorySlug: null,
      amount: '40000',
      toAccountId: ctx.usd.id,
      toAmount: '10',
      toCurrency: 'USD',
    });
    ctx.ledger.save(tx);
    refreshLedger();
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: tx.id });
    await render(<EditTransaction />);
    expect(screen.getByLabelText('Monto que sale (COP)').props.value).toBe('40000');
    expect(screen.getByLabelText('Monto que entra (USD)').props.value).toBe('10');

    await type('Monto que entra (USD)', '12,50');
    await fireEvent.press(button('Guardar cambios'));
    expect(ctx.ledger.findById(tx.id)).toMatchObject({ amount: '40000', toAmount: '12.50' });
  });

  it('Inicio ofrece "Transferir" con dos o más cuentas activas', async () => {
    setup();
    await render(<Home />);
    await fireEvent.press(button('Transferir'));
    expect(router.push).toHaveBeenCalledWith('/transfer');
  });

  it('con una sola cuenta activa Inicio no ofrece "Transferir"', async () => {
    signInWith();
    setupLedger([efectivo()]);
    await render(<Home />);
    expect(screen.queryByRole('button', { name: 'Transferir' })).toBeNull();
  });

  it('la transferencia hecha sin red queda en el outbox como una sola fila', async () => {
    const ctx = setup(false);
    await render(<Transfer />);
    await fireEvent.press(radio('Hacia Nequi'));
    await type('Monto', '20.000');
    await fireEvent.press(button('Transferir'));
    expect(ctx.queue.items).toHaveLength(1);
    expect(ctx.queue.items[0]).toMatchObject({ entity: 'transaction', operation: 'upsert' });
    expect(ctx.requests).toHaveLength(0);
  });
});
