import { localToday } from '@saveria/shared';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { refreshLedger } from '../src/features/transactions/ledger';
import { useSession } from '../src/session/session-store';
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
}));

import Home from '../src/app/(app)/home';

afterEach(() => {
  resetLedger();
  jest.clearAllMocks();
});

const palette = (mode: 'light' | 'dark') => (mode === 'light' ? lightColors : darkColors);
const flat = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;
const DISPLAY_FONT = 'BricolageGrotesque';
const today = localToday();

/** Una cuenta de Inicio con correo verificado (así no aparece el aviso y los bloques son los fijos). */
function signInVerified(options: Parameters<typeof signInWith>[0] = {}) {
  signInWith(options);
  const me = useSession.getState().me;
  if (me) useSession.setState({ me: { ...me, emailVerified: true } });
}

function twoAccounts() {
  const efectivo = makeAccountRecord({
    name: 'Efectivo',
    isDefault: true,
    initialBalance: '100000',
  });
  const nequi = makeAccountRecord({ name: 'Nequi', type: 'wallet', initialBalance: '50000' });
  const { ledger } = setupLedger([efectivo, nequi]);
  ledger.save(makeTxRecord(efectivo.id, { occurredOn: today, description: 'almuerzo' }));
  ledger.save(
    makeTxRecord(nequi.id, {
      type: 'income',
      categorySlug: 'salary',
      amount: '40000',
      occurredOn: today,
    }),
  );
  refreshLedger();
  return { efectivo, nequi };
}

describe('Inicio con identidad propia (historia 1)', () => {
  renderInBothModes(
    '1.1 saludo, tarjeta de balance y cuentas con el estilo nuevo',
    async (mode) => {
      signInVerified();
      twoAccounts();
      await render(<Home />);
      const colors = palette(mode);

      const greeting = screen.getByRole('heading', { name: 'Hola, ana' });
      expect(flat(greeting)).toMatchObject({ fontFamily: DISPLAY_FONT, color: colors.text });

      const balance = screen.getByTestId('balance-card');
      expect(flat(balance)).toMatchObject({
        backgroundColor: colors.hero,
        borderTopLeftRadius: 34,
        borderBottomRightRadius: 34,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 12,
      });
      expect(within(balance).getByText('Tu balance total')).toBeTruthy();
      // Efectivo 100.000 − 18.000 = 82.000 y Nequi 50.000 + 40.000 = 90.000.
      expect(screen.getByLabelText('Total: $ 172.000 COP')).toBeTruthy();
      const figure = screen.getByTestId('balance-figure');
      expect(flat(figure)).toMatchObject({ fontFamily: DISPLAY_FONT, color: colors.onHero });
      expect(figure.props.numberOfLines).toBe(1);
      expect(figure.props.adjustsFontSizeToFit).toBe(true);

      expect(
        within(screen.getByLabelText('Saldo de Efectivo')).getByText('$ 82.000 COP'),
      ).toBeTruthy();
      expect(
        within(screen.getByLabelText('Saldo de Nequi')).getByText('$ 90.000 COP'),
      ).toBeTruthy();
      expect(screen.getByTestId('accounts-row').props.horizontal).toBe(true);
      // Con letra grande el saldo se achica en vez de cortarse con «…» (SC-005).
      expect(screen.getByText('$ 82.000 COP').props.adjustsFontSizeToFit).toBe(true);
    },
  );

  renderInBothModes(
    '1.2 con monedas distintas la tarjeta muestra la cuenta por defecto',
    async () => {
      signInVerified();
      const efectivo = makeAccountRecord({
        name: 'Efectivo',
        isDefault: true,
        initialBalance: '50000',
      });
      const ahorros = makeAccountRecord({
        name: 'Ahorros USD',
        currency: 'USD',
        initialBalance: '10',
      });
      setupLedger([efectivo, ahorros]);
      await render(<Home />);
      const balance = screen.getByTestId('balance-card');
      expect(within(balance).getByText('Saldo de Efectivo')).toBeTruthy();
      expect(within(balance).getByText('Tienes cuentas en otras monedas')).toBeTruthy();
      expect(screen.queryByLabelText(/^Total/)).toBeNull();
      // La misma cuenta sigue en la fila de cuentas, con su nombre accesible de siempre.
      expect(
        within(screen.getByLabelText('Saldo de Efectivo')).getByText('$ 50.000 COP'),
      ).toBeTruthy();
    },
  );

  renderInBothModes(
    '1.3 cada movimiento lleva ícono, título, cuenta y monto con signo y color',
    async (mode) => {
      signInVerified();
      twoAccounts();
      await render(<Home />);
      const colors = palette(mode);

      const gasto = screen.getByRole('button', { name: 'Restaurantes y domicilios 18000' });
      expect(
        within(gasto).getByTestId('category-icon', { includeHiddenElements: true }),
      ).toBeTruthy();
      expect(within(gasto).getByText('Restaurantes y domicilios')).toBeTruthy();
      expect(within(gasto).getByText('Efectivo · almuerzo')).toBeTruthy();
      expect(flat(within(gasto).getByText('−$ 18.000')).color).toBe(colors.text);

      const ingreso = screen.getByRole('button', { name: 'Salario 40000' });
      expect(within(ingreso).getByText('Nequi')).toBeTruthy();
      expect(flat(within(ingreso).getByText('+$ 40.000')).color).toBe(colors.positive);
      expect(screen.getByText('Hoy')).toBeTruthy();
    },
  );

  renderInBothModes('1.4 un saldo negativo se destaca en rojo y con su signo', async (mode) => {
    signInVerified();
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    const { ledger } = setupLedger([efectivo]);
    ledger.save(makeTxRecord(efectivo.id, { occurredOn: today }));
    refreshLedger();
    await render(<Home />);
    const tile = within(screen.getByLabelText('Saldo de Efectivo'));
    expect(flat(tile.getByText('−$ 18.000 COP')).color).toBe(palette(mode).negative);
  });

  renderInBothModes(
    '1.5 sin movimientos hay un mensaje amable en vez de una lista vacía',
    async () => {
      signInVerified();
      setupLedger([makeAccountRecord({ name: 'Efectivo', isDefault: true })]);
      await render(<Home />);
      expect(
        screen.getByText('Aún no tienes movimientos. Toca el botón + para registrar el primero.'),
      ).toBeTruthy();
      expect(screen.queryByText('Hoy')).toBeNull();
    },
  );

  it('1.5 sin moneda principal no se invita a registrar', async () => {
    signInVerified();
    const me = useSession.getState().me;
    if (me)
      useSession.setState({ me: { ...me, profile: { ...me.profile, primaryCurrency: null } } });
    setupLedger([makeAccountRecord({ name: 'Efectivo', isDefault: true })]);
    await render(<Home />);
    expect(screen.queryByText(/Aún no tienes movimientos/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Registrar movimiento' })).toBeNull();
  });

  it('1.6 sin conexión muestra la misma pantalla y los mismos datos', async () => {
    signInVerified({ isOnline: false });
    twoAccounts();
    await render(<Home />);
    expect(screen.getByLabelText('Total: $ 172.000 COP')).toBeTruthy();
    expect(screen.getByText('−$ 18.000')).toBeTruthy();
    expect(screen.getByText('+$ 40.000')).toBeTruthy();
  });

  it('«Transferir» está en la tarjeta de balance y solo con dos cuentas activas', async () => {
    signInVerified();
    setupLedger([makeAccountRecord({ name: 'Efectivo', isDefault: true })]);
    const { unmount } = await render(<Home />);
    expect(screen.queryByRole('button', { name: 'Transferir' })).toBeNull();
    await unmount();
    resetLedger();

    twoAccounts();
    await render(<Home />);
    const button = screen.getByRole('button', { name: 'Transferir' });
    expect(
      within(screen.getByTestId('balance-card')).getByRole('button', { name: 'Transferir' }),
    ).toBe(button);
    await fireEvent.press(button);
    expect(router.push).toHaveBeenCalledWith('/transfer');
  });

  it('Inicio ya no trae el botón de registrar ni los enlaces que pasaron a la barra y a Ajustes', async () => {
    signInVerified();
    twoAccounts();
    await render(<Home />);
    for (const name of [
      'Registrar movimiento',
      'Cuentas de dinero',
      'Configuración',
      'Cerrar sesión',
    ]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Ver todo' }));
    expect(router.push).toHaveBeenCalledWith('/transactions');
  });
});

describe('los bloques de Inicio van en el orden del mapa de la app (FR-032)', () => {
  const blocks = () => screen.getAllByTestId(/^home-block-/).map((node) => node.props.testID);

  it('saludo, balance, cuentas y últimos movimientos', async () => {
    signInVerified();
    twoAccounts();
    await render(<Home />);
    expect(blocks()).toEqual([
      'home-block-greeting',
      'home-block-balance',
      'home-block-accounts',
      'home-block-recent',
    ]);
  });

  it('con el correo sin verificar, el aviso va entre el saludo y el balance', async () => {
    signInWith();
    twoAccounts();
    await render(<Home />);
    expect(blocks()).toEqual([
      'home-block-greeting',
      'home-block-verify',
      'home-block-balance',
      'home-block-accounts',
      'home-block-recent',
    ]);
  });

  it('sin movimientos no hay bloque de últimos movimientos', async () => {
    signInVerified();
    setupLedger([makeAccountRecord({ name: 'Efectivo', isDefault: true })]);
    await render(<Home />);
    expect(blocks()).toEqual([
      'home-block-greeting',
      'home-block-balance',
      'home-block-accounts',
      'home-block-empty',
    ]);
  });
});

describe('textos largos y muchas cuentas', () => {
  it('un nombre de cuenta de 40 caracteres y un monto de 12 dígitos no rompen la pantalla', async () => {
    signInVerified();
    const largo = 'Cuenta de ahorros para el viaje de fin de año';
    const nombre = largo.slice(0, 40);
    setupLedger([
      makeAccountRecord({ name: nombre, isDefault: true, initialBalance: '123456789012' }),
    ]);
    await render(<Home />);
    expect(screen.getByLabelText(`Saldo de ${nombre}`)).toBeTruthy();
    const figure = screen.getByTestId('balance-figure');
    expect(figure.props.adjustsFontSizeToFit).toBe(true);
    expect(
      within(screen.getByLabelText(`Saldo de ${nombre}`)).getByText('$ 123.456.789.012 COP'),
    ).toBeTruthy();
  });

  it('con 20 cuentas activas las muestra todas y la tarjeta sigue mostrando el total', async () => {
    signInVerified();
    const cuentas = Array.from({ length: 20 }, (_, i) =>
      makeAccountRecord({
        name: `Cuenta ${i + 1}`,
        isDefault: i === 0,
        initialBalance: '1000',
      }),
    );
    setupLedger(cuentas);
    await render(<Home />);
    expect(screen.getAllByLabelText(/^Saldo de Cuenta /)).toHaveLength(20);
    expect(screen.getByLabelText('Total: $ 20.000 COP')).toBeTruthy();
  });
});
