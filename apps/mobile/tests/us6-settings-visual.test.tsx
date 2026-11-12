import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { router, usePathname } from 'expo-router';
import { StyleSheet } from 'react-native';
import { authService } from '../src/features/auth/auth-service';
import { UNDO_MS, UndoSnackbar, useUndo } from '../src/features/transactions/UndoSnackbar';
import { useSession } from '../src/session/session-store';
import { darkColors, lightColors } from '../src/theme/palettes';
import { renderInBothModes } from './support/color-scheme';
import { signInWith } from './support/ledger';

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
    usePathname: jest.fn(() => '/home'),
    useLocalSearchParams: jest.fn(() => ({})),
    router: { navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  };
});

import AppLayout from '../src/app/(app)/_layout';
import ChangePassword from '../src/app/(app)/settings/change-password';
import DeleteAccount from '../src/app/(app)/settings/delete-account';
import Settings from '../src/app/(app)/settings/index';
import VerifyEmailGate from '../src/app/(app)/verify-email-gate';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  useUndo.setState({ id: null });
  jest.mocked(usePathname).mockReturnValue('/home');
});

const palette = (mode: 'light' | 'dark') => (mode === 'light' ? lightColors : darkColors);
const flat = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;
const DISPLAY_FONT = 'BricolageGrotesque';

describe('Configuración y avisos coherentes (historia 6)', () => {
  renderInBothModes('6.1 Configuración agrupa sus opciones en tarjetas con ícono', async (mode) => {
    signInWith();
    await render(<Settings />);
    const colors = palette(mode);

    expect(flat(screen.getByRole('heading', { name: 'Configuración' })).fontFamily).toBe(
      DISPLAY_FONT,
    );
    const groups: [string, string][] = [
      ['saveria', 'Saveria'],
      ['region', 'País y moneda'],
      ['account', 'Tu cuenta'],
    ];
    for (const [id, title] of groups) {
      const group = screen.getByTestId(`settings-group-${id}`);
      expect(flat(group)).toMatchObject({ backgroundColor: colors.surface, borderRadius: 24 });
      expect(within(group).getByRole('heading', { name: title })).toBeTruthy();
      expect(
        within(group).getByTestId('settings-group-icon', { includeHiddenElements: true }),
      ).toBeTruthy();
    }
    // Cada opción vive en su grupo y conserva su nombre.
    expect(
      within(screen.getByTestId('settings-group-saveria')).getByLabelText('Nombre para la IA'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('settings-group-saveria')).getByRole('radio', { name: 'Manual' }),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('settings-group-region')).getByLabelText('Ciudad'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('settings-group-region')).getByRole('radio', { name: 'Colombia' }),
    ).toBeTruthy();
    const cuenta = within(screen.getByTestId('settings-group-account'));
    for (const name of ['Cambiar contraseña', 'Borrar mi cuenta', 'Cerrar sesión']) {
      expect(cuenta.getByRole('button', { name })).toBeTruthy();
    }
    expect(flat(screen.getByRole('button', { name: 'Guardar cambios' })).backgroundColor).toBe(
      colors.primary,
    );
  });

  it('6.1 «Cerrar sesión» sigue haciendo lo mismo y Ajustes no tiene «Volver»', async () => {
    signInWith();
    const logout = jest.spyOn(authService, 'logout').mockResolvedValue({ pendingChanges: 0 });
    await render(<Settings />);
    expect(screen.queryByRole('button', { name: 'Volver' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(logout).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(router.push).toHaveBeenCalledWith('/settings/change-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Borrar mi cuenta' }));
    expect(router.push).toHaveBeenCalledWith('/settings/delete-account');
  });

  renderInBothModes(
    '6.2 borrar la cuenta sigue siendo inequívoco: definitivo, sin tono motivador',
    async (mode) => {
      signInWith();
      jest.spyOn(authService, 'pendingChanges').mockReturnValue(2);
      await render(<DeleteAccount />);
      const colors = palette(mode);

      expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Borrar mi cuenta' })).toBeTruthy();
      const body = screen.getByText(
        'Se borrarán tu cuenta y todos tus datos: movimientos, cuentas, relatos y preferencias, en este dispositivo y en el servidor.',
      );
      expect(flat(body).color).toBe(colors.text);
      const final = screen.getByText('Esta acción no se puede deshacer.');
      expect(flat(final).color).toBe(colors.negative);
      expect(
        screen.getAllByTestId('field-error-icon', { includeHiddenElements: true }).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByText('Tienes 2 cambios sin sincronizar: se descartarán junto con tu cuenta.'),
      ).toBeTruthy();
      // Sin contraseña no se puede borrar.
      expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeDisabled();
      await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'clave1234');
      expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeEnabled();
    },
  );

  renderInBothModes('cambiar la contraseña conserva sus campos y avisos', async (mode) => {
    signInWith();
    await render(<ChangePassword />);
    expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Cambiar contraseña' })).toBeTruthy();
    expect(screen.getByLabelText('Contraseña actual')).toBeTruthy();
    expect(screen.getByLabelText('Contraseña nueva')).toBeTruthy();
    expect(
      flat(screen.getByText('Mínimo 8 caracteres, con al menos una letra y un número.')).color,
    ).toBe(palette(mode).textMuted);
    expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeDisabled();
  });

  renderInBothModes('6.3 «Movimiento borrado · Deshacer» se lee en los dos modos', async (mode) => {
    useUndo.setState({ id: '0199a1b2-0000-7000-8000-000000000009' });
    await render(<UndoSnackbar />);
    const bar = screen.getByTestId('undo-snackbar');
    expect(flat(bar).backgroundColor).toBe(palette(mode).inverse);
    expect(flat(screen.getByText('Movimiento borrado')).color).toBe(palette(mode).onInverse);
    const action = screen.getByRole('button', { name: 'Deshacer' });
    expect(Number(flat(action).minHeight)).toBeGreaterThanOrEqual(48);
    expect(flat(screen.getByText('Deshacer')).color).toBe(palette(mode).onInverse);
  });

  it('6.3 «Deshacer» dura los mismos 6 segundos', async () => {
    jest.useFakeTimers();
    useUndo.setState({ id: '0199a1b2-0000-7000-8000-000000000009' });
    await render(<UndoSnackbar />);
    expect(UNDO_MS).toBe(6000);
    await act(async () => {
      jest.advanceTimersByTime(UNDO_MS - 1);
    });
    expect(screen.getByText('Movimiento borrado')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Movimiento borrado')).toBeNull();
  });

  it('6.3 el aviso queda por encima de la barra y del «+»; sin barra, abajo', async () => {
    signInWith();
    useUndo.setState({ id: '0199a1b2-0000-7000-8000-000000000009' });
    jest.mocked(usePathname).mockReturnValue('/home');
    const { unmount } = await render(<AppLayout />);
    // Barra de 64 + margen del sistema de 16 + lo que sobresale el «+» (22) + 8 de aire.
    expect(flat(screen.getByTestId('undo-snackbar')).bottom).toBe(64 + 16 + 22 + 8);
    await unmount();

    jest.mocked(usePathname).mockReturnValue('/transactions/new');
    await render(<AppLayout />);
    expect(flat(screen.getByTestId('undo-snackbar')).bottom).toBe(24);
  });

  renderInBothModes(
    '6.4 el bloqueo por correo sin verificar conserva su comportamiento con el estilo nuevo',
    async (mode) => {
      signInWith();
      useSession.setState({ isOnline: true });
      const logout = jest.spyOn(authService, 'logout').mockResolvedValue({ pendingChanges: 0 });
      await render(<VerifyEmailGate />);

      expect(
        screen.getByRole('heading', { name: 'Confirma tu correo para continuar' }),
      ).toBeTruthy();
      expect(
        flat(screen.getByText(/Pasaron 7 días y tu correo ana@mail.com sigue sin confirmar/)).color,
      ).toBe(palette(mode).text);
      expect(
        flat(screen.getByRole('button', { name: 'Ya confirmé mi correo' })).backgroundColor,
      ).toBe(palette(mode).primary);
      for (const name of ['Reenviar correo', 'Cambiar correo', 'Cerrar sesión']) {
        expect(screen.getByRole('button', { name })).toBeTruthy();
      }
      expect(screen.getByLabelText('Correo correcto')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
      expect(logout).toHaveBeenCalledTimes(1);
    },
  );
});
