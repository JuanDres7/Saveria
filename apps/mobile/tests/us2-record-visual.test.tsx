import { categoriesFor } from '@saveria/shared';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { refreshLedger } from '../src/features/transactions/ledger';
import { darkColors, lightColors } from '../src/theme/palettes';
import { renderInBothModes, setSafeAreaInsets, withFontScale } from './support/color-scheme';
import {
  makeAccountRecord,
  makeTxRecord,
  resetLedger,
  setupLedger,
  signInWith,
} from './support/ledger';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

import EditTransaction from '../src/app/(app)/transactions/[id]';
import NewTransaction from '../src/app/(app)/transactions/new';
import Transfer from '../src/app/(app)/transfer';

afterEach(() => {
  resetLedger();
  jest.clearAllMocks();
});

const palette = (mode: 'light' | 'dark') => (mode === 'light' ? lightColors : darkColors);
const flat = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;
const DISPLAY_FONT = 'BricolageGrotesque';

function twoAccounts() {
  const efectivo = makeAccountRecord({
    name: 'Efectivo',
    isDefault: true,
    initialBalance: '100000',
  });
  const nequi = makeAccountRecord({ name: 'Nequi', type: 'wallet', initialBalance: '50000' });
  const setup = setupLedger([efectivo, nequi]);
  return { efectivo, nequi, ...setup };
}

describe('Registrar un movimiento con el nuevo estilo (historia 2)', () => {
  renderInBothModes('2.1 cada categoría es un chip con su ícono y su nombre', async () => {
    signInWith();
    twoAccounts();
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    await render(<NewTransaction />);

    const gastos = categoriesFor('expense');
    expect(gastos).toHaveLength(18);
    for (const category of gastos) {
      const chip = screen.getByRole('radio', { name: category.name });
      expect(within(chip).getByTestId('chip-icon', { includeHiddenElements: true })).toBeTruthy();
    }
    // Las de ingreso se distinguen: solo aparecen al elegir «Ingreso».
    expect(screen.queryByRole('radio', { name: 'Salario' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Ingreso' }));
    for (const category of categoriesFor('income')) {
      const chip = screen.getByRole('radio', { name: category.name });
      expect(within(chip).getByTestId('chip-icon', { includeHiddenElements: true })).toBeTruthy();
    }
    expect(screen.queryByRole('radio', { name: 'Mercado' })).toBeNull();
  });

  renderInBothModes('2.2 monto, categoría y guardar: máximo 3 toques más el monto', async () => {
    signInWith();
    const { ledger } = twoAccounts();
    await render(<NewTransaction />);

    await fireEvent.changeText(screen.getByLabelText('Monto'), '18.000');
    await fireEvent.press(screen.getByRole('radio', { name: 'Restaurantes y domicilios' })); // toque 1
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' })); // toque 2

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(ledger.rows).toHaveLength(1);
    expect(ledger.rows[0]).toMatchObject({
      type: 'expense',
      amount: '18000',
      categorySlug: 'dining',
    });
  });

  renderInBothModes(
    '2.3 tocar una categoría cierra el teclado y «Guardar» queda a la vista',
    async (mode) => {
      signInWith();
      twoAccounts();
      const dismiss = jest.spyOn(Keyboard, 'dismiss');
      await render(<NewTransaction />);

      await fireEvent.press(screen.getByRole('radio', { name: 'Transporte' }));
      expect(dismiss).toHaveBeenCalled();

      const footer = screen.getByTestId('form-footer');
      expect(within(footer).getByRole('button', { name: 'Guardar' })).toBeTruthy();
      // «Guardar» no está dentro del área que se desplaza.
      expect(
        within(screen.getByTestId('form-scroll')).queryByRole('button', { name: 'Guardar' }),
      ).toBeNull();
      expect(flat(footer).backgroundColor).toBe(palette(mode).surface);
      dismiss.mockRestore();
    },
  );

  it('2.3 el pie respeta el margen inferior del sistema', async () => {
    signInWith();
    twoAccounts();
    setSafeAreaInsets({ bottom: 34 });
    await render(<NewTransaction />);
    expect(Number(flat(screen.getByTestId('form-footer')).paddingBottom)).toBeGreaterThanOrEqual(
      34,
    );
    setSafeAreaInsets({ bottom: 16 });
  });

  renderInBothModes('2.4 los errores aparecen junto al campo con ícono y texto', async (mode) => {
    signInWith();
    twoAccounts();
    await render(<NewTransaction />);

    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

    const icons = screen.getAllByTestId('field-error-icon', { includeHiddenElements: true });
    // Falta el monto y falta la categoría: dos errores, cada uno con su ícono.
    expect(icons.length).toBeGreaterThanOrEqual(2);
    expect(router.back).not.toHaveBeenCalled();
    expect(flat(screen.getByLabelText('Monto')).borderColor).toBe(palette(mode).negative);
  });

  renderInBothModes(
    'el monto es grande, en la letra de identidad, y dice en qué moneda va',
    async () => {
      signInWith();
      twoAccounts();
      await render(<NewTransaction />);
      const amount = screen.getByLabelText('Monto');
      expect(flat(amount)).toMatchObject({ fontFamily: DISPLAY_FONT, fontSize: 44 });
      expect(screen.getByText('Monto en COP')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Registrar movimiento' })).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'Gasto' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Efectivo' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Hoy' })).toBeChecked();
    },
  );

  it('con letra al 150 % los nombres largos de categoría no se cortan', async () => {
    signInWith();
    twoAccounts();
    await withFontScale(1.5, async () => {
      await render(<NewTransaction />);
      const label = screen.getByText('Restaurantes y domicilios');
      expect(label.props.numberOfLines).toBeUndefined();
      expect(label.props.allowFontScaling).not.toBe(false);
    });
  });
});

describe('editar un movimiento y transferir usan los mismos elementos (2.5, FR-016)', () => {
  renderInBothModes(
    'Registrar, Editar y Transferir tienen volver, chips y botón de pie',
    async () => {
      signInWith();
      const { efectivo, nequi, ledger } = twoAccounts();
      const gasto = makeTxRecord(efectivo.id, { occurredOn: '2026-10-28' });
      const transferencia = makeTxRecord(efectivo.id, {
        type: 'transfer',
        categorySlug: null,
        toAccountId: nequi.id,
        amount: '20000',
        toAmount: '20000',
        toCurrency: 'COP',
      });
      ledger.save(gasto);
      ledger.save(transferencia);
      refreshLedger();

      const screens: [string, () => ReactElement, string, string][] = [
        ['Registrar movimiento', () => <NewTransaction />, 'Guardar', 'Gasto'],
        ['Editar movimiento', () => <EditTransaction />, 'Guardar cambios', 'Gasto'],
        ['Editar transferencia', () => <EditTransaction />, 'Guardar cambios', 'Hoy'],
        ['Transferir', () => <Transfer />, 'Transferir', 'Hoy'],
      ];
      for (const [title, view, submit, aRadio] of screens) {
        if (title === 'Editar movimiento')
          (useLocalSearchParams as jest.Mock).mockReturnValue({ id: gasto.id });
        else if (title === 'Editar transferencia')
          (useLocalSearchParams as jest.Mock).mockReturnValue({ id: transferencia.id });
        else (useLocalSearchParams as jest.Mock).mockReturnValue({});
        const { unmount } = await render(view());

        expect(screen.getByRole('heading', { name: title })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
        expect(screen.getByRole('radio', { name: aRadio })).toBeTruthy();
        expect(
          within(screen.getByTestId('form-footer')).getByRole('button', { name: submit }),
        ).toBeTruthy();
        await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
        expect(router.back).toHaveBeenCalled();
        (router.back as jest.Mock).mockClear();
        await unmount();
      }
    },
  );

  renderInBothModes('al editar, «Borrar» sigue en el pie junto a «Guardar cambios»', async () => {
    signInWith();
    const { efectivo, ledger } = twoAccounts();
    const gasto = makeTxRecord(efectivo.id, { occurredOn: '2026-10-28' });
    ledger.save(gasto);
    refreshLedger();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: gasto.id });
    await render(<EditTransaction />);
    const footer = within(screen.getByTestId('form-footer'));
    expect(footer.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy();
    expect(footer.getByRole('button', { name: 'Borrar' })).toBeTruthy();
  });
});
