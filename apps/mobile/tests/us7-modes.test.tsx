import { fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { useSession } from '../src/session/session-store';
import { darkColors, lightColors, type ThemeColors } from '../src/theme/palettes';
import { renderInBothModes, setColorScheme } from './support/color-scheme';
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
  usePathname: jest.fn(() => '/home'),
}));

import AccountDetail from '../src/app/(app)/accounts/[id]';
import AdjustBalance from '../src/app/(app)/accounts/[id]/adjust';
import ArchivedAccounts from '../src/app/(app)/accounts/archived';
import Accounts from '../src/app/(app)/accounts/index';
import NewAccount from '../src/app/(app)/accounts/new';
import Home from '../src/app/(app)/home';
import EditTransaction from '../src/app/(app)/transactions/[id]';
import History from '../src/app/(app)/transactions/index';
import NewTransaction from '../src/app/(app)/transactions/new';
import Transfer from '../src/app/(app)/transfer';
import ForgotPassword from '../src/app/(auth)/forgot-password';
import Login from '../src/app/(auth)/login';
import Register from '../src/app/(auth)/register';
import Welcome from '../src/app/(auth)/welcome';
import AiMode from '../src/app/(onboarding)/ai-mode';
import AiName from '../src/app/(onboarding)/ai-name';
import City from '../src/app/(onboarding)/city';
import Country from '../src/app/(onboarding)/country';
import Currency from '../src/app/(onboarding)/currency';
import { UndoSnackbar, useUndo } from '../src/features/transactions/UndoSnackbar';
import { AppTabBar } from '../src/ui/AppTabBar';

afterEach(() => {
  resetLedger();
  useUndo.setState({ id: null });
  jest.clearAllMocks();
});

const palette = (mode: 'light' | 'dark'): ThemeColors =>
  mode === 'light' ? lightColors : darkColors;
const flat = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;

type Json = { type: string; props: Record<string, unknown>; children: Json[] | null };

/** Todos los colores que una pantalla dibuja: en estilos y en las propiedades de color de los controles. */
function colorsIn(tree: unknown): Set<string> {
  const found = new Set<string>();
  const isColor = (value: unknown): value is string =>
    typeof value === 'string' && /^(#[0-9a-fA-F]{3,8}|rgba?\()/.test(value);
  const COLOR_PROPS = [
    'placeholderTextColor',
    'cursorColor',
    'selectionColor',
    'stroke',
    'fill',
    'color',
  ];
  const walk = (node: Json | Json[] | string | null) => {
    if (!node || typeof node === 'string') return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    const style = StyleSheet.flatten(node.props?.style as never) as
      | Record<string, unknown>
      | undefined;
    for (const [key, value] of Object.entries(style ?? {})) {
      if (/color/i.test(key) && isColor(value)) found.add(value);
    }
    for (const key of COLOR_PROPS) {
      const value = node.props?.[key];
      if (isColor(value)) found.add(value);
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree as Json | Json[] | null);
  return found;
}

function seed() {
  signInWith();
  const efectivo = makeAccountRecord({
    name: 'Efectivo',
    isDefault: true,
    initialBalance: '100000',
  });
  const nequi = makeAccountRecord({ name: 'Nequi', type: 'wallet', initialBalance: '-5000' });
  const setup = setupLedger([efectivo, nequi]);
  const gasto = makeTxRecord(efectivo.id, { occurredOn: '2026-10-28', description: 'almuerzo' });
  const ingreso = makeTxRecord(nequi.id, {
    type: 'income',
    categorySlug: 'salary',
    amount: '40000',
    occurredOn: '2026-10-28',
  });
  const transferencia = makeTxRecord(efectivo.id, {
    type: 'transfer',
    categorySlug: null,
    toAccountId: nequi.id,
    amount: '20000',
    toAmount: '20000',
    toCurrency: 'COP',
    occurredOn: '2026-10-28',
  });
  setup.ledger.save(gasto);
  setup.ledger.save(ingreso);
  setup.ledger.save(transferencia);
  refreshAll();
  return { efectivo, nequi, gasto, transferencia };
}

function refreshAll() {
  const { refreshLedger } = require('../src/features/transactions/ledger');
  refreshLedger();
}

describe('claro y oscuro de punta a punta (historia 7)', () => {
  const screens: [
    string,
    (ids: ReturnType<typeof seed>) => ReactElement,
    Record<string, string>?,
  ][] = [
    ['la bienvenida', () => <Welcome />],
    ['crear cuenta', () => <Register />],
    ['iniciar sesión', () => <Login />],
    ['recuperar contraseña', () => <ForgotPassword />],
    ['onboarding paso 1', () => <AiName />],
    ['onboarding paso 2', () => <Country />],
    ['onboarding paso 3', () => <City />],
    ['onboarding paso 4', () => <Currency />],
    ['onboarding paso 5', () => <AiMode />],
    ['Inicio', () => <Home />],
    ['Registrar movimiento', () => <NewTransaction />],
    ['Editar movimiento', () => <EditTransaction />],
    ['Transferir', () => <Transfer />],
    ['Historial', () => <History />],
    ['Cuentas', () => <Accounts />],
    ['Nueva cuenta', () => <NewAccount />],
    ['Cuentas archivadas', () => <ArchivedAccounts />],
    ['detalle de una cuenta', () => <AccountDetail />],
    ['ajustar saldo', () => <AdjustBalance />],
    ['la barra inferior', () => <AppTabBar />],
  ];

  for (const [name, view] of screens) {
    renderInBothModes(
      `7.1 y 7.2 ${name}: todos sus colores salen de la paleta del modo`,
      async (mode) => {
        const ids = seed();
        jest
          .mocked(useLocalSearchParams)
          .mockReturnValue({ id: name === 'Editar movimiento' ? ids.gasto.id : ids.nequi.id });
        await render(view(ids));
        const allowed = new Set<string>(Object.values(palette(mode)));
        const stray = [...colorsIn(screen.toJSON())].filter((color) => !allowed.has(color));
        expect(stray).toEqual([]);
      },
    );
  }

  renderInBothModes('7.2 el aviso «Deshacer» usa los colores del modo', async (mode) => {
    useUndo.setState({ id: '0199a1b2-0000-7000-8000-000000000009' });
    await render(<UndoSnackbar />);
    const stray = [...colorsIn(screen.toJSON())].filter(
      (color) => !new Set<string>(Object.values(palette(mode))).has(color),
    );
    expect(stray).toEqual([]);
  });

  it('7.3 cambiar el modo con «Registrar movimiento» abierto conserva el monto y la categoría', async () => {
    seed();
    await render(<NewTransaction />);
    await fireEvent.changeText(screen.getByLabelText('Monto'), '18000');
    await fireEvent.press(screen.getByRole('radio', { name: 'Transporte' }));
    expect(flat(screen.getByTestId('form-footer')).backgroundColor).toBe(lightColors.surface);

    await setColorScheme('dark');
    expect(screen.getByLabelText('Monto').props.value).toBe('18000');
    expect(screen.getByRole('radio', { name: 'Transporte' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Gasto' })).toBeChecked();
    expect(flat(screen.getByTestId('form-footer')).backgroundColor).toBe(darkColors.surface);

    await setColorScheme('light');
    expect(screen.getByLabelText('Monto').props.value).toBe('18000');
    expect(flat(screen.getByTestId('form-footer')).backgroundColor).toBe(lightColors.surface);
  });

  it('7.3 cambiar el modo en Crear cuenta conserva lo escrito', async () => {
    signInWith();
    useSession.setState({ isOnline: true });
    await render(<Register />);
    await fireEvent.changeText(screen.getByLabelText('Correo'), 'ana@mail.com');
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Acepto la política de tratamiento de datos' }),
    );
    await setColorScheme('dark');
    expect(screen.getByLabelText('Correo').props.value).toBe('ana@mail.com');
    expect(
      screen.getByRole('checkbox', { name: 'Acepto la política de tratamiento de datos' }),
    ).toBeChecked();
    await setColorScheme('light');
  });

  renderInBothModes(
    '7.4 gasto en el color del texto con «−» e ingreso en verde con «+»',
    async (mode) => {
      seed();
      await render(<History />);
      const colors = palette(mode);
      expect(flat(screen.getByText('-$ 18.000')).color).toBe(colors.text);
      expect(flat(screen.getByText('+$ 40.000')).color).toBe(colors.positive);
    },
  );

  renderInBothModes('7.4 un saldo negativo va en rojo con su signo', async (mode) => {
    signInWith();
    setupLedger([makeAccountRecord({ name: 'Nequi', isDefault: true, initialBalance: '-5000' })]);
    await render(<Accounts />);
    expect(flat(screen.getByText('-$ 5.000 COP')).color).toBe(palette(mode).negative);
  });

  renderInBothModes(
    '7.5 la lámina, los chips y los campos se distinguen del fondo',
    async (mode) => {
      seed();
      const colors = palette(mode);
      // Los pares de superficie que se apoyan unos sobre otros no pueden ser iguales.
      expect(colors.surface).not.toBe(colors.background);
      expect(colors.surfaceSoft).not.toBe(colors.surface);
      expect(colors.surfaceSoft).not.toBe(colors.background);
      expect(colors.hero).not.toBe(colors.background);
      await render(<Accounts />);
      const tile = screen.getByRole('button', { name: 'Abrir Efectivo' });
      expect(flat(tile).backgroundColor).toBe(colors.surfaceSoft);
    },
  );
});
