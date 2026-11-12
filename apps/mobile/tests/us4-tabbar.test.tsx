import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { Settings as SettingsIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { authService } from '../src/features/auth/auth-service';
import { useSession } from '../src/session/session-store';
import { darkColors, lightColors } from '../src/theme/palettes';
import { TAB_ITEMS, TabBar } from '../src/ui/TabBar';
import { renderInBothModes, setSafeAreaInsets } from './support/color-scheme';
import { makeAccountRecord, resetLedger, setupLedger, signInWith } from './support/ledger';

// Expo Router simulado: `Stack.Protected` solo muestra a sus hijos si `guard` es verdadero.
jest.mock('expo-router', () => {
  const React = require('react');
  const Screen = ({ name }: { name: string }) => React.createElement('Screen', { name });
  const Protected = ({ guard, children }: { guard: boolean; children: unknown }) =>
    guard ? React.createElement(React.Fragment, null, children) : null;
  const Stack = Object.assign(
    ({ children }: { children: unknown }) => React.createElement('Stack', null, children),
    { Screen, Protected },
  );
  return {
    Stack,
    Redirect: ({ href }: { href: string }) => React.createElement('Redirect', { href }),
    usePathname: jest.fn(() => '/home'),
    useLocalSearchParams: jest.fn(() => ({})),
    router: { navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  };
});

import AppLayout from '../src/app/(app)/_layout';
import AccountDetail from '../src/app/(app)/accounts/[id]';
import Settings from '../src/app/(app)/settings/index';

afterEach(() => {
  resetLedger();
  jest.clearAllMocks();
  jest.mocked(usePathname).mockReturnValue('/home');
  setSafeAreaInsets({ bottom: 16 });
});

const palette = (mode: 'light' | 'dark') => (mode === 'light' ? lightColors : darkColors);
const flat = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;

const NAMES = ['Inicio', 'Movimientos', 'Cuentas', 'Ajustes'];

describe('la barra inferior (TabBar)', () => {
  renderInBothModes('4.1 cuatro secciones con ícono y nombre, la actual marcada', async (mode) => {
    await render(
      <TabBar
        activePath="/transactions"
        showRegister
        onSelect={jest.fn()}
        onRegister={jest.fn()}
      />,
    );
    const colors = palette(mode);
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    for (const name of NAMES) expect(screen.getByRole('tab', { name })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toBeSelected();
    for (const name of ['Inicio', 'Cuentas', 'Ajustes']) {
      expect(screen.getByRole('tab', { name })).not.toBeSelected();
    }
    expect(flat(screen.getByTestId('tab-pill-/transactions')).backgroundColor).toBe(colors.sage);
    expect(flat(screen.getByTestId('tab-pill-/home')).backgroundColor).toBeUndefined();
    expect(flat(screen.getByText('Movimientos')).fontWeight).toBe('700');
  });

  it('4.2 tocar otra sección la abre; tocar la actual no hace nada', async () => {
    const onSelect = jest.fn();
    await render(
      <TabBar activePath="/home" showRegister onSelect={onSelect} onRegister={jest.fn()} />,
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Cuentas' }));
    expect(onSelect).toHaveBeenCalledWith('/accounts');
    onSelect.mockClear();
    await fireEvent.press(screen.getByRole('tab', { name: 'Inicio' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  renderInBothModes(
    '4.6 el botón «+» es «Registrar movimiento», de forma de hoja y de al menos 48 dp',
    async (mode) => {
      const onRegister = jest.fn();
      await render(
        <TabBar activePath="/home" showRegister onSelect={jest.fn()} onRegister={onRegister} />,
      );
      const button = screen.getByRole('button', { name: 'Registrar movimiento' });
      expect(screen.getAllByRole('button', { name: 'Registrar movimiento' })).toHaveLength(1);
      const fab = flat(screen.getByTestId('tab-register'));
      expect(fab).toMatchObject({
        backgroundColor: palette(mode).primary,
        borderTopLeftRadius: 20,
        borderBottomRightRadius: 20,
        borderTopRightRadius: 8,
        borderBottomLeftRadius: 8,
      });
      expect(Number(fab.width)).toBeGreaterThanOrEqual(48);
      expect(Number(fab.height)).toBeGreaterThanOrEqual(48);
      await fireEvent.press(button);
      expect(onRegister).toHaveBeenCalledTimes(1);
    },
  );

  it('4.7 sin moneda principal el «+» no se dibuja, pero las cuatro secciones sí', async () => {
    await render(
      <TabBar
        activePath="/home"
        showRegister={false}
        onSelect={jest.fn()}
        onRegister={jest.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Registrar movimiento' })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  renderInBothModes(
    'cada sección mide al menos 48 dp y suma el margen inferior del sistema',
    async (mode) => {
      setSafeAreaInsets({ bottom: 34 });
      await render(
        <TabBar activePath="/home" showRegister onSelect={jest.fn()} onRegister={jest.fn()} />,
      );
      for (const name of NAMES) {
        expect(Number(flat(screen.getByRole('tab', { name })).minHeight)).toBeGreaterThanOrEqual(
          48,
        );
      }
      // Con letra grande el nombre se achica en una línea: no se parte a media palabra ni se corta.
      for (const name of NAMES) {
        const label = screen.getByText(name);
        expect(label.props.numberOfLines).toBe(1);
        expect(label.props.adjustsFontSizeToFit).toBe(true);
      }
      const bar = flat(screen.getByTestId('tab-bar'));
      expect(Number(bar.paddingBottom)).toBeGreaterThanOrEqual(34);
      expect(bar.backgroundColor).toBe(palette(mode).surface);
    },
  );

  it('FR-032 la barra se arma desde una lista y cada elemento puede mostrar un punto de aviso', async () => {
    expect(TAB_ITEMS.map((item) => item.label)).toEqual(NAMES);
    const items = [
      ...TAB_ITEMS,
      { key: 'extra', label: 'Saveria', icon: SettingsIcon, path: '/saveria', badge: true },
    ];
    await render(
      <TabBar
        items={items}
        activePath="/home"
        showRegister
        onSelect={jest.fn()}
        onRegister={jest.fn()}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Saveria' })).toBeTruthy();
    expect(screen.getAllByTestId('tab-badge', { includeHiddenElements: true })).toHaveLength(1);
  });
});

describe('la barra en la app (layout)', () => {
  function app(
    pathname: string,
    options: { primary?: boolean; gate?: boolean; online?: boolean } = {},
  ) {
    signInWith({ isOnline: options.online ?? true });
    const me = useSession.getState().me;
    if (me) {
      useSession.setState({
        me: {
          ...me,
          verificationRequired: options.gate ?? false,
          profile: { ...me.profile, primaryCurrency: options.primary === false ? null : 'COP' },
        },
      });
    }
    jest.mocked(usePathname).mockReturnValue(pathname);
  }

  it.each(['/home', '/transactions', '/accounts', '/settings'])(
    '4.1 se ve en la sección %s',
    async (path) => {
      app(path);
      await render(<AppLayout />);
      expect(screen.getByTestId('tab-bar')).toBeTruthy();
      expect(screen.getAllByRole('tab')).toHaveLength(4);
    },
  );

  it.each([
    '/transactions/new',
    '/transactions/0199a1b2-0000-7000-8000-000000000009',
    '/transfer',
    '/accounts/new',
    '/accounts/archived',
    '/accounts/0199a1b2-0000-7000-8000-000000000008',
    '/accounts/0199a1b2-0000-7000-8000-000000000008/adjust',
    '/settings/change-password',
    '/settings/delete-account',
  ])('4.3 no aparece en la pantalla de formulario o detalle %s', async (path) => {
    app(path);
    await render(<AppLayout />);
    expect(screen.queryByTestId('tab-bar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Registrar movimiento' })).toBeNull();
  });

  it('4.5 no aparece en el bloqueo por correo sin verificar', async () => {
    app('/verify-email-gate', { gate: true });
    await render(<AppLayout />);
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('4.2 la sección de la ruta actual queda marcada y tocar otra navega a ella', async () => {
    app('/accounts');
    await render(<AppLayout />);
    expect(screen.getByRole('tab', { name: 'Cuentas' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Movimientos' }));
    expect(router.navigate).toHaveBeenCalledWith('/transactions');
  });

  it('4.6 el «+» abre Registrar movimiento desde cualquiera de las cuatro secciones', async () => {
    for (const path of ['/home', '/transactions', '/accounts', '/settings']) {
      app(path);
      const { unmount } = await render(<AppLayout />);
      await fireEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }));
      expect(router.push).toHaveBeenLastCalledWith('/transactions/new');
      await unmount();
    }
  });

  it('4.7 sin moneda principal el «+» no aparece (misma regla que antes)', async () => {
    app('/home', { primary: false });
    await render(<AppLayout />);
    expect(screen.queryByRole('button', { name: 'Registrar movimiento' })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('4.4 sin conexión la barra funciona igual', async () => {
    app('/home', { online: false });
    await render(<AppLayout />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Ajustes' }));
    expect(router.navigate).toHaveBeenCalledWith('/settings');
  });
});

describe('lo que la barra reemplaza en las pantallas (FR-014, FR-020)', () => {
  it('Ajustes ya no tiene «Volver» y trae «Cerrar sesión» con la misma acción', async () => {
    signInWith();
    const logout = jest.spyOn(authService, 'logout').mockResolvedValue({ pendingChanges: 0 });
    await render(<Settings />);
    expect(screen.queryByRole('button', { name: 'Volver' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('4.6 el detalle de una cuenta ofrece «Registrar movimiento» y conserva «Transferir desde esta cuenta»', async () => {
    signInWith();
    const efectivo = makeAccountRecord({ name: 'Efectivo', isDefault: true });
    setupLedger([efectivo]);
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: efectivo.id });
    await render(<AccountDetail />);
    await fireEvent.press(screen.getByRole('button', { name: 'Registrar movimiento' }));
    expect(router.push).toHaveBeenCalledWith('/transactions/new');
    expect(screen.getByRole('button', { name: 'Transferir desde esta cuenta' })).toBeTruthy();
  });
});
