import { localToday } from '@saveria/shared';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Dimensions, StyleSheet } from 'react-native';
import { refreshLedger } from '../src/features/transactions/ledger';
import { useSession } from '../src/session/session-store';
import { darkColors, lightColors } from '../src/theme/palettes';
import { type as typeScale } from '../src/theme/tokens';
import { List, SlidersHorizontal } from '../src/ui/icons';
import { formatMoney } from '../src/ui/money';
import { TAB_ITEMS } from '../src/ui/TabBar';
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

import Accounts from '../src/app/(app)/accounts/index';
import Home from '../src/app/(app)/home';
import History from '../src/app/(app)/transactions/index';
import NewTransaction from '../src/app/(app)/transactions/new';
import Welcome from '../src/app/(auth)/welcome';

afterEach(() => {
  resetLedger();
  jest.clearAllMocks();
});

const palette = (mode: 'light' | 'dark') => (mode === 'light' ? lightColors : darkColors);
const flat = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;
const hidden = { includeHiddenElements: true } as const;
const today = localToday();

function twoAccountsWithMovements() {
  const efectivo = makeAccountRecord({
    name: 'Efectivo',
    isDefault: true,
    initialBalance: '100000',
  });
  const nequi = makeAccountRecord({ name: 'Nequi', type: 'wallet', initialBalance: '-5000' });
  const { ledger } = setupLedger([efectivo, nequi]);
  ledger.save(makeTxRecord(efectivo.id, { occurredOn: today, description: 'almuerzo' }));
  refreshLedger();
  return { efectivo, nequi };
}

function signInVerified() {
  signInWith();
  const me = useSession.getState().me;
  if (me) useSession.setState({ me: { ...me, emailVerified: true } });
}

/** Ajustes para que la app se vea como la maqueta aprobada «La hoja de Saveria». */
describe('la app se ve como la maqueta aprobada', () => {
  it('1. el saludo y la cifra del balance son grandes, como en la maqueta', () => {
    expect(typeScale.title.fontSize).toBe(30);
    expect(typeScale.figure.fontSize).toBe(44);
  });

  renderInBothModes('2. en la bienvenida la hoja ocupa media pantalla', async () => {
    const { width, height } = Dimensions.get('window');
    await render(<Welcome />);
    const hero = flat(screen.getByTestId('welcome-hero'));
    expect(Number(hero.height)).toBeGreaterThanOrEqual(height * 0.45);
    expect(Number(hero.height)).toBeLessThanOrEqual(height * 0.56);
    expect(Number(hero.borderBottomRightRadius)).toBeGreaterThanOrEqual(width * 0.5);
  });

  renderInBothModes('3. Inicio lleva la marca de hoja junto al saludo', async (mode) => {
    signInVerified();
    twoAccountsWithMovements();
    await render(<Home />);
    const greeting = within(screen.getByTestId('home-block-greeting'));
    const mark = greeting.getByTestId('brand-mark', hidden);
    expect(flat(mark).backgroundColor).toBe(palette(mode).primary);
    // Es adorno: no se lee.
    expect(greeting.queryByTestId('brand-mark')).toBeNull();
  });

  it('4. «Ver todas» y «Ver todo» van junto al título de su bloque', async () => {
    signInVerified();
    twoAccountsWithMovements();
    await render(<Home />);
    const cuentas = within(screen.getByTestId('home-block-accounts'));
    const verTodas = cuentas.getByRole('button', { name: 'Ver todas las cuentas' });
    expect(within(verTodas).getByText('Ver todas')).toBeTruthy();
    expect(within(cuentas.getByTestId('section-header')).getByText('Ver todas')).toBeTruthy();
    await fireEvent.press(verTodas);
    expect(router.push).toHaveBeenCalledWith('/accounts');

    const recientes = within(screen.getByTestId('home-block-recent'));
    expect(within(recientes.getByTestId('section-header')).getByText('Ver todo')).toBeTruthy();
    await fireEvent.press(recientes.getByRole('button', { name: 'Ver todo' }));
    expect(router.push).toHaveBeenCalledWith('/transactions');
  });

  renderInBothModes('5. Movimientos: título propio y el conteo justo debajo', async () => {
    signInWith();
    twoAccountsWithMovements();
    await render(<History />);
    const heading = within(screen.getByTestId('history-heading'));
    expect(heading.getByRole('heading', { name: 'Movimientos' })).toBeTruthy();
    expect(heading.getByText('Mostrando 1 movimientos')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Historial' })).toBeNull();
  });

  renderInBothModes('6. el monto lleva el símbolo de la moneda y no tiene línea', async (mode) => {
    signInWith();
    twoAccountsWithMovements();
    await render(<NewTransaction />);
    const amount = screen.getByLabelText('Monto');
    expect(flat(amount).borderBottomWidth ?? 0).toBe(0);
    const symbol = screen.getByTestId('amount-symbol');
    expect(symbol.props.children).toBe('$');
    expect(flat(symbol).fontFamily).toBe('BricolageGrotesque');
    // Sin monto, el símbolo va apagado como el ejemplo; con monto, en el color del texto.
    expect(flat(symbol).color).toBe(palette(mode).border);
    await fireEvent.changeText(amount, '18000');
    expect(flat(screen.getByTestId('amount-symbol')).color).toBe(palette(mode).text);
  });

  renderInBothModes('7. Cuentas: filas sobre una sola lámina y «Nueva» arriba', async (mode) => {
    signInWith();
    const { efectivo } = twoAccountsWithMovements();
    await render(<Accounts />);
    const colors = palette(mode);
    expect(screen.getByRole('heading', { name: 'Cuentas' })).toBeTruthy();
    const sheet = screen.getByTestId('accounts-sheet');
    expect(flat(sheet)).toMatchObject({ backgroundColor: colors.surface, borderTopLeftRadius: 26 });
    const fila = within(sheet).getByRole('button', { name: 'Abrir Efectivo' });
    // Una fila, no una tarjeta: sin fondo propio.
    expect(flat(fila).backgroundColor).toBeUndefined();
    expect(Number(flat(fila).minHeight)).toBeGreaterThanOrEqual(48);
    const nueva = within(sheet).getByRole('button', { name: 'Nueva cuenta' });
    expect(within(nueva).getByText('Nueva')).toBeTruthy();
    expect(flat(nueva).backgroundColor).toBeUndefined();
    await fireEvent.press(nueva);
    expect(router.push).toHaveBeenCalledWith('/accounts/new');
    await fireEvent.press(fila);
    expect(router.push).toHaveBeenCalledWith(`/accounts/${efectivo.id}`);
    expect(within(sheet).getByRole('button', { name: 'Cuentas archivadas' })).toBeTruthy();
  });

  it('8. los montos negativos usan el signo menos tipográfico', async () => {
    expect(formatMoney('-18000', 'COP')).toBe('−$ 18.000');
    expect(formatMoney('18000', 'COP')).toBe('$ 18.000');
    signInVerified();
    twoAccountsWithMovements();
    await render(<Home />);
    expect(screen.getByText('−$ 18.000')).toBeTruthy();
    expect(screen.getByText('−$ 5.000 COP')).toBeTruthy();
    expect(screen.queryByText(/^-\$/)).toBeNull();
  });

  it('9. los filtros de Movimientos van en una sola fila que se desliza', async () => {
    signInWith();
    twoAccountsWithMovements();
    await render(<History />);
    const filters = screen.getByTestId('history-filters');
    expect(filters.props.horizontal).toBe(true);
    expect(within(filters).getByRole('radio', { name: 'Todas' })).toBeChecked();
    expect(within(filters).getByRole('radio', { name: 'Nequi' })).toBeTruthy();
  });

  it('10. los formularios no llevan la forma de fondo; las secciones sí', async () => {
    signInWith();
    twoAccountsWithMovements();
    const { unmount } = await render(<NewTransaction />);
    expect(screen.queryByTestId('screen-blob', hidden)).toBeNull();
    await unmount();
    await render(<History />);
    expect(screen.getByTestId('screen-blob', hidden)).toBeTruthy();
  });

  renderInBothModes('11. «Ya tengo cuenta» va en negrita y sin subrayar', async (mode) => {
    await render(<Welcome />);
    const text = flat(screen.getByText('Ya tengo cuenta'));
    expect(text.textDecorationLine).toBeUndefined();
    expect(text.fontWeight).toBe('700');
    expect(text.color).toBe(palette(mode).primary);
    const link = screen.getByRole('link', { name: 'Ya tengo cuenta' });
    expect(Number(flat(link).minHeight)).toBeGreaterThanOrEqual(48);
  });

  it('12. la barra usa el ícono de lista en Movimientos y el de controles en Ajustes', () => {
    const byKey = Object.fromEntries(TAB_ITEMS.map((item) => [item.key, item.icon]));
    expect(byKey.transactions).toBe(List);
    expect(byKey.settings).toBe(SlidersHorizontal);
  });
});
