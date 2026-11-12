import { localToday } from '@saveria/shared';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { refreshLedger } from '../src/features/transactions/ledger';
import { lightColors } from '../src/theme/palettes';
import {
  makeAccountRecord,
  makeTxRecord,
  resetLedger,
  setupLedger,
  signInWith,
} from './support/ledger';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));

import Home from '../src/app/(app)/home';
import History from '../src/app/(app)/transactions/index';

afterEach(() => {
  resetLedger();
  jest.clearAllMocks();
});

const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return localToday(date);
};

/** Tarjeta de saldo de una cuenta en Inicio (nombre + saldo). */
const card = (name: string) => screen.getByLabelText(`Saldo de ${name}`);

describe('historia 2: ver el historial y el saldo', () => {
  it('2.1 saldo inicial 100.000 + 50.000 − 30.000 = 120.000', async () => {
    signInWith();
    const efectivo = makeAccountRecord({
      name: 'Efectivo',
      isDefault: true,
      initialBalance: '100000',
    });
    const { ledger } = setupLedger([efectivo]);
    ledger.save(
      makeTxRecord(efectivo.id, { type: 'income', categorySlug: 'salary', amount: '50000' }),
    );
    ledger.save(makeTxRecord(efectivo.id, { amount: '30000' }));
    refreshLedger();
    await render(<Home />);
    expect(within(card('Efectivo')).getByText('$ 120.000 COP')).toBeTruthy();
  });

  it('2.2 el historial agrupa por día, del más reciente al más antiguo, con todos los datos', async () => {
    signInWith();
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const { ledger } = setupLedger([efectivo]);
    ledger.save(makeTxRecord(efectivo.id, { occurredOn: '2026-10-01', description: 'viejo' }));
    ledger.save(
      makeTxRecord(efectivo.id, { occurredOn: day(-1), categorySlug: 'transport', amount: '3700' }),
    );
    ledger.save(
      makeTxRecord(efectivo.id, {
        occurredOn: day(0),
        type: 'income',
        categorySlug: 'salary',
        amount: '2000000',
        description: 'Quincena',
      }),
    );
    refreshLedger();
    await render(<History />);

    const headers = screen.getAllByRole('header').map((h) => h.props.children);
    expect(headers).toEqual(['Hoy', 'Ayer', '1 de octubre de 2026']);
    expect(screen.getByText('Salario')).toBeTruthy();
    expect(screen.getByText('+$ 2.000.000')).toBeTruthy();
    expect(screen.getByText('Efectivo · Quincena')).toBeTruthy();
    expect(screen.getByText('−$ 3.700')).toBeTruthy();
    expect(screen.getByText('Transporte')).toBeTruthy();
  });

  it('2.3 el filtro por cuenta deja solo sus movimientos, también las transferencias que entran', async () => {
    signInWith();
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const nequi = makeAccountRecord({ name: 'Nequi', type: 'wallet' });
    const { ledger } = setupLedger([efectivo, nequi]);
    ledger.save(makeTxRecord(efectivo.id, { description: 'gasto efectivo' }));
    ledger.save(makeTxRecord(nequi.id, { description: 'gasto nequi' }));
    ledger.save(
      makeTxRecord(efectivo.id, {
        type: 'transfer',
        categorySlug: null,
        amount: '20000',
        toAccountId: nequi.id,
        toAmount: '20000',
        toCurrency: 'COP',
      }),
    );
    refreshLedger();
    await render(<History />);
    expect(screen.getByText(/gasto efectivo/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Nequi' }));
    expect(screen.queryByText(/gasto efectivo/)).toBeNull();
    expect(screen.getByText(/gasto nequi/)).toBeTruthy();
    // La transferencia entra a Nequi: se ve con signo +.
    expect(screen.getByText('Transferencia')).toBeTruthy();
    expect(screen.getByText('+$ 20.000')).toBeTruthy();
    expect(screen.getByText(/Efectivo → Nequi/)).toBeTruthy();
  });

  it('2.4 con cuentas en COP y en USD cada saldo va en su moneda y no hay total', async () => {
    signInWith({ currency: 'COP' });
    setupLedger([
      makeAccountRecord({ name: 'Efectivo', isDefault: true, initialBalance: '50000' }),
      makeAccountRecord({ name: 'Ahorros USD', currency: 'USD', initialBalance: '10' }),
    ]);
    await render(<Home />);
    expect(within(card('Efectivo')).getByText('$ 50.000 COP')).toBeTruthy();
    expect(within(card('Ahorros USD')).getByText('US$ 10,00 USD')).toBeTruthy();
    expect(screen.queryByLabelText(/^Total/)).toBeNull();
  });

  it('2.5 con todas en la moneda principal hay total, sin contar las archivadas', async () => {
    signInWith({ currency: 'COP' });
    setupLedger([
      makeAccountRecord({ name: 'Efectivo', isDefault: true, initialBalance: '50000' }),
      makeAccountRecord({ name: 'Nequi', initialBalance: '30000' }),
      makeAccountRecord({
        name: 'Vieja USD',
        currency: 'USD',
        initialBalance: '5',
        archivedAt: '2026-10-20T00:00:00.000Z',
      }),
      makeAccountRecord({
        name: 'Vieja COP',
        initialBalance: '999',
        archivedAt: '2026-10-20T00:00:00.000Z',
      }),
    ]);
    await render(<Home />);
    expect(screen.getByLabelText('Total: $ 80.000 COP')).toBeTruthy();
    // Las archivadas no salen en Inicio.
    expect(screen.queryByLabelText('Saldo de Vieja COP')).toBeNull();
  });

  it('2.6 sin conexión se ven los movimientos y los saldos guardados en el teléfono', async () => {
    signInWith({ isOnline: false });
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const { ledger } = setupLedger([efectivo]);
    ledger.save(makeTxRecord(efectivo.id, { description: 'sin red' }));
    refreshLedger();
    await render(<Home />);
    expect(screen.getByText(/sin red/)).toBeTruthy();
    expect(within(card('Efectivo')).getByText('−$ 18.000 COP')).toBeTruthy();
  });

  it('FR-014 un saldo negativo se muestra destacado en rojo', async () => {
    signInWith();
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const { ledger } = setupLedger([efectivo]);
    ledger.save(makeTxRecord(efectivo.id));
    refreshLedger();
    await render(<Home />);
    expect(within(card('Efectivo')).getByText('−$ 18.000 COP')).toHaveStyle({
      color: lightColors.negative,
    });
  });

  it('Inicio agrupa los últimos movimientos por día y "Ver todo" abre el historial', async () => {
    signInWith();
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const { ledger } = setupLedger([efectivo]);
    ledger.save(makeTxRecord(efectivo.id, { occurredOn: day(0) }));
    ledger.save(makeTxRecord(efectivo.id, { occurredOn: day(-1) }));
    refreshLedger();
    await render(<Home />);
    expect(screen.getAllByRole('header').map((h) => h.props.children)).toEqual(['Hoy', 'Ayer']);
    await fireEvent.press(screen.getByRole('button', { name: 'Ver todo' }));
    expect(router.push).toHaveBeenCalledWith('/transactions');
  });

  it('el historial carga de 50 en 50', async () => {
    signInWith();
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const { ledger } = setupLedger([efectivo]);
    for (let i = 0; i < 60; i++) ledger.save(makeTxRecord(efectivo.id, { description: `m${i}` }));
    refreshLedger();
    await render(<History />);
    expect(screen.getByText('Mostrando 50 movimientos')).toBeTruthy();
    await fireEvent(screen.getByTestId('history-list'), 'onEndReached');
    expect(screen.getByText('Mostrando 60 movimientos')).toBeTruthy();
  });
});
