import { localToday } from '@saveria/shared';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { refreshLedger } from '../src/features/transactions/ledger';
import { darkColors, lightColors } from '../src/theme/palettes';
import { renderInBothModes } from './support/color-scheme';
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
import AdjustBalance from '../src/app/(app)/accounts/[id]/adjust';
import ArchivedAccounts from '../src/app/(app)/accounts/archived';
import Accounts from '../src/app/(app)/accounts/index';
import NewAccount from '../src/app/(app)/accounts/new';
import History from '../src/app/(app)/transactions/index';

afterEach(() => {
  resetLedger();
  jest.clearAllMocks();
});

const palette = (mode: 'light' | 'dark') => (mode === 'light' ? lightColors : darkColors);
const flat = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;
const DISPLAY_FONT = 'BricolageGrotesque';
const today = localToday();

function withHistory() {
  const efectivo = makeAccountRecord({
    name: 'Efectivo',
    isDefault: true,
    initialBalance: '100000',
  });
  const nequi = makeAccountRecord({ name: 'Nequi', type: 'wallet', initialBalance: '50000' });
  const setup = setupLedger([efectivo, nequi]);
  setup.ledger.save(makeTxRecord(efectivo.id, { occurredOn: today, description: 'almuerzo' }));
  setup.ledger.save(
    makeTxRecord(nequi.id, {
      type: 'income',
      categorySlug: 'salary',
      amount: '40000',
      occurredOn: today,
    }),
  );
  refreshLedger();
  return { efectivo, nequi, ...setup };
}

describe('Historial con el nuevo estilo (5.1)', () => {
  renderInBothModes(
    'muestra los movimientos por día con ícono, título, cuenta y monto con signo',
    async (mode) => {
      signInWith();
      withHistory();
      await render(<History />);
      const colors = palette(mode);

      expect(flat(screen.getByRole('heading', { name: 'Historial' })).fontFamily).toBe(
        DISPLAY_FONT,
      );
      expect(screen.getByText('Mostrando 2 movimientos')).toBeTruthy();
      expect(screen.getAllByRole('header').map((h) => h.props.children)).toEqual(['Hoy']);

      const gasto = screen.getByRole('button', { name: 'Restaurantes y domicilios 18000' });
      expect(
        within(gasto).getByTestId('category-icon', { includeHiddenElements: true }),
      ).toBeTruthy();
      expect(within(gasto).getByText('Efectivo · almuerzo')).toBeTruthy();
      expect(flat(within(gasto).getByText('-$ 18.000')).color).toBe(colors.text);
      const ingreso = screen.getByRole('button', { name: 'Salario 40000' });
      expect(flat(within(ingreso).getByText('+$ 40.000')).color).toBe(colors.positive);
    },
  );

  renderInBothModes('los filtros por cuenta son chips y filtran la lista', async (mode) => {
    signInWith();
    withHistory();
    await render(<History />);
    const todas = screen.getByRole('radio', { name: 'Todas' });
    expect(todas).toBeChecked();
    expect(flat(todas).backgroundColor).toBe(palette(mode).primary);
    await fireEvent.press(screen.getByRole('radio', { name: 'Nequi' }));
    expect(screen.getByRole('radio', { name: 'Nequi' })).toBeChecked();
    expect(screen.getByText('Mostrando 1 movimientos')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Restaurantes y domicilios 18000' })).toBeNull();
  });

  renderInBothModes('sin movimientos invita a registrar el primero (FR-013)', async () => {
    signInWith();
    setupLedger([makeAccountRecord({ name: 'Efectivo', isDefault: true })]);
    await render(<History />);
    expect(screen.getByText('Todavía no hay movimientos.')).toBeTruthy();
    expect(screen.getByText('Cuando registres uno, aparecerá aquí.')).toBeTruthy();
  });
});

describe('Cuentas con el nuevo estilo (5.2)', () => {
  renderInBothModes(
    'cada cuenta es una tarjeta con nombre, saldo en su moneda y «por defecto» con texto',
    async (mode) => {
      signInWith();
      const efectivo = makeAccountRecord({
        name: 'Efectivo',
        isDefault: true,
        initialBalance: '100000',
      });
      const nequi = makeAccountRecord({ name: 'Nequi', type: 'wallet', initialBalance: '-5000' });
      setupLedger([efectivo, nequi]);
      await render(<Accounts />);
      const colors = palette(mode);

      expect(flat(screen.getByRole('heading', { name: 'Cuentas de dinero' })).fontFamily).toBe(
        DISPLAY_FONT,
      );
      const ef = screen.getByRole('button', { name: 'Abrir Efectivo' });
      expect(within(ef).getByText('Efectivo')).toBeTruthy();
      expect(within(ef).getByText('$ 100.000 COP')).toBeTruthy();
      expect(within(ef).getByText('Cuenta por defecto')).toBeTruthy();
      expect(Number(flat(ef).minHeight)).toBeGreaterThanOrEqual(48);

      const nq = screen.getByRole('button', { name: 'Abrir Nequi' });
      expect(flat(within(nq).getByText('-$ 5.000 COP')).color).toBe(colors.negative);
      expect(within(nq).queryByText('Cuenta por defecto')).toBeNull();

      await fireEvent.press(ef);
      expect(router.push).toHaveBeenCalledWith(`/accounts/${efectivo.id}`);
      expect(flat(screen.getByRole('button', { name: 'Nueva cuenta' }))).toMatchObject({
        width: '100%',
        backgroundColor: colors.primary,
      });
      expect(screen.getByRole('button', { name: 'Cuentas archivadas' })).toBeTruthy();
    },
  );

  it('un nombre de 40 caracteres y 20 cuentas no rompen la lista', async () => {
    signInWith();
    const largo = makeAccountRecord({
      name: 'Cuenta de ahorros para el viaje de fin ',
      isDefault: true,
    });
    const otras = Array.from({ length: 19 }, (_, i) =>
      makeAccountRecord({ name: `Cuenta ${i + 1}` }),
    );
    setupLedger([largo, ...otras]);
    await render(<Accounts />);
    expect(screen.getAllByRole('button', { name: /^Abrir / })).toHaveLength(20);
    expect(screen.getByRole('button', { name: `Abrir ${largo.name}` })).toBeTruthy();
  });

  renderInBothModes(
    'un rechazo del servidor se ve con ícono, texto y se puede corregir abriendo la cuenta',
    async () => {
      signInWith();
      const rota = makeAccountRecord({
        name: 'Efectivo',
        isDefault: true,
        syncState: 'rejected',
        syncError: 'Ya tienes una cuenta activa con ese nombre',
      });
      setupLedger([rota]);
      await render(<Accounts />);
      const row = screen.getByRole('button', { name: 'Abrir Efectivo' });
      expect(
        within(row).getByText('No se pudo guardar: Ya tienes una cuenta activa con ese nombre'),
      ).toBeTruthy();
      expect(
        within(row).getByTestId('field-error-icon', { includeHiddenElements: true }),
      ).toBeTruthy();
    },
  );

  renderInBothModes('5.4 un movimiento rechazado se ve con ícono y su motivo', async (mode) => {
    signInWith();
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const { ledger } = setupLedger([efectivo]);
    ledger.save(
      makeTxRecord(efectivo.id, {
        occurredOn: today,
        syncState: 'rejected',
        syncError: 'La cuenta no existe',
      }),
    );
    refreshLedger();
    await render(<History />);
    const message = screen.getByText('No se pudo guardar: La cuenta no existe');
    expect(flat(message).color).toBe(palette(mode).negative);
    expect(screen.getByTestId('field-error-icon', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('Cuentas archivadas, nueva, detalle y ajustar saldo (5.3)', () => {
  renderInBothModes('archivadas: «Volver», mensaje vacío con texto amable', async () => {
    signInWith();
    setupLedger([makeAccountRecord({ name: 'Efectivo', isDefault: true })]);
    await render(<ArchivedAccounts />);
    expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Cuentas archivadas' })).toBeTruthy();
    expect(screen.getByText('No tienes cuentas archivadas.')).toBeTruthy();
  });

  renderInBothModes('archivadas: lista la cuenta con su saldo', async () => {
    signInWith();
    setupLedger([
      makeAccountRecord({ name: 'Efectivo', isDefault: true }),
      makeAccountRecord({
        name: 'Vieja',
        initialBalance: '2000',
        archivedAt: '2026-10-01T00:00:00.000Z',
      }),
    ]);
    await render(<ArchivedAccounts />);
    expect(
      within(screen.getByRole('button', { name: 'Abrir Vieja' })).getByText('$ 2.000 COP'),
    ).toBeTruthy();
    expect(screen.queryByText('No tienes cuentas archivadas.')).toBeNull();
  });

  renderInBothModes(
    'nueva cuenta: «Volver», campos, chips con ícono de elegido y botón ancho',
    async (mode) => {
      signInWith();
      setupLedger([makeAccountRecord({ name: 'Efectivo', isDefault: true })]);
      await render(<NewAccount />);
      expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Nueva cuenta de dinero' })).toBeTruthy();
      expect(screen.getByLabelText('Nombre')).toBeTruthy();
      expect(screen.getByLabelText('Saldo inicial')).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'Billetera digital' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'COP' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Usar como cuenta por defecto' })).toBeTruthy();
      expect(flat(screen.getByRole('button', { name: 'Crear cuenta' })).backgroundColor).toBe(
        palette(mode).primary,
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));
      expect(
        screen.getAllByTestId('field-error-icon', { includeHiddenElements: true }).length,
      ).toBeGreaterThan(0);
    },
  );

  renderInBothModes(
    'detalle: «Volver», saldo, indicadores con texto y todas sus acciones',
    async (mode) => {
      signInWith();
      const efectivo = makeAccountRecord({
        name: 'Efectivo',
        isDefault: true,
        initialBalance: '100000',
      });
      const nequi = makeAccountRecord({ name: 'Nequi', type: 'wallet', initialBalance: '5000' });
      setupLedger([efectivo, nequi]);
      jest.mocked(useLocalSearchParams).mockReturnValue({ id: nequi.id });
      await render(<AccountDetail />);
      const colors = palette(mode);

      expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
      expect(flat(screen.getByRole('heading', { name: 'Nequi' })).fontFamily).toBe(DISPLAY_FONT);
      expect(flat(screen.getByText('Saldo: $ 5.000 COP')).color).toBe(colors.text);
      for (const name of [
        'Guardar cambios',
        'Registrar movimiento',
        'Ajustar saldo',
        'Transferir desde esta cuenta',
        'Usar como cuenta por defecto',
        'Archivar',
      ]) {
        expect(screen.getByRole('button', { name })).toBeTruthy();
      }
      await fireEvent.press(screen.getByRole('button', { name: 'Archivar' }));
      expect(screen.getByText(/Al archivarla deja de sumar en el total/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Sí, archivar' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    },
  );

  renderInBothModes(
    'ajustar saldo: «Volver», saldo actual y la misma diferencia de siempre',
    async () => {
      signInWith();
      const efectivo = makeAccountRecord({
        name: 'Efectivo',
        isDefault: true,
        initialBalance: '100000',
      });
      setupLedger([efectivo]);
      jest.mocked(useLocalSearchParams).mockReturnValue({ id: efectivo.id });
      await render(<AdjustBalance />);
      expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Ajustar Efectivo' })).toBeTruthy();
      expect(screen.getByText('Saldo actual: $ 100.000 COP')).toBeTruthy();
      await fireEvent.changeText(screen.getByLabelText('Saldo real'), '115.000');
      expect(screen.getByText('Diferencia: $ 15.000')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Ajustar saldo' })).toBeEnabled();
    },
  );
});
