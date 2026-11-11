import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSession } from '../src/session/session-store';
import { darkColors, lightColors } from '../src/theme/palettes';
import { renderInBothModes, withFontScale } from './support/color-scheme';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));

import ForgotPassword from '../src/app/(auth)/forgot-password';
import Login from '../src/app/(auth)/login';
import Register from '../src/app/(auth)/register';
import Welcome from '../src/app/(auth)/welcome';
import AiMode from '../src/app/(onboarding)/ai-mode';
import AiName from '../src/app/(onboarding)/ai-name';
import City from '../src/app/(onboarding)/city';
import Country from '../src/app/(onboarding)/country';
import Currency from '../src/app/(onboarding)/currency';

afterEach(() => {
  useSession.setState({ notice: null, isOnline: true });
  jest.clearAllMocks();
});

const palette = (mode: 'light' | 'dark') => (mode === 'light' ? lightColors : darkColors);
const flat = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;
const DISPLAY_FONT = 'BricolageGrotesque';

describe('Entrar y empezar con la misma identidad (historia 3)', () => {
  renderInBothModes('3.1 la bienvenida: marca, mensaje breve y las dos acciones', async (mode) => {
    await render(<Welcome />);
    const colors = palette(mode);

    const hero = screen.getByTestId('welcome-hero');
    expect(flat(hero).backgroundColor).toBe(colors.hero);
    expect(Number(flat(hero).borderBottomRightRadius)).toBeGreaterThan(100);
    expect(flat(screen.getByText('Saveria')).fontFamily).toBe(DISPLAY_FONT);

    const title = screen.getByRole('heading', { name: 'Bienvenido a Saveria' });
    expect(flat(title)).toMatchObject({ fontFamily: DISPLAY_FONT, color: colors.text });
    const text = screen.getByText('Cuéntale a Saveria tus gastos e ingresos con tus palabras.');
    expect(flat(text).color).toBe(colors.textMuted);

    const create = screen.getByRole('button', { name: 'Crear cuenta' });
    expect(flat(create)).toMatchObject({ width: '100%', backgroundColor: colors.primary });
    const login = screen.getByRole('link', { name: 'Ya tengo cuenta' });
    expect(Number(flat(login).minHeight)).toBeGreaterThanOrEqual(48);

    await fireEvent.press(create);
    expect(router.push).toHaveBeenCalledWith('/register');
    await fireEvent.press(login);
    expect(router.push).toHaveBeenCalledWith('/login');
  });

  it('3.1 el aviso que deja el cierre de sesión sigue cerrándose al tocarlo', async () => {
    useSession.setState({ notice: 'Se quedaron cambios sin enviar' });
    await render(<Welcome />);
    await fireEvent.press(screen.getByText('Se quedaron cambios sin enviar'));
    expect(useSession.getState().notice).toBeNull();
  });

  renderInBothModes(
    '3.2 crear cuenta: campos, ayuda, política y botón conservan sus nombres',
    async (mode) => {
      await render(<Register />);
      const colors = palette(mode);
      expect(screen.getByRole('heading', { name: 'Crea tu cuenta' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
      expect(screen.getByLabelText('Correo')).toBeTruthy();
      expect(screen.getByLabelText('Contraseña')).toBeTruthy();
      const help = screen.getByText('Mínimo 8 caracteres, con al menos una letra y un número.');
      expect(flat(help).color).toBe(colors.textMuted);
      expect(screen.getByRole('link', { name: 'política de tratamiento de datos' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();
      expect(screen.getByRole('link', { name: 'Ya tengo cuenta' })).toBeTruthy();
    },
  );

  renderInBothModes(
    '3.4 la casilla de la política se lee marcada y sin marcar, con ícono además del color',
    async (mode) => {
      await render(<Register />);
      const box = screen.getByRole('checkbox', {
        name: 'Acepto la política de tratamiento de datos',
      });
      expect(box).not.toBeChecked();
      expect(screen.queryByTestId('policy-check', { includeHiddenElements: true })).toBeNull();
      expect(Number(flat(box).minHeight)).toBeGreaterThanOrEqual(48);

      await fireEvent.press(box);
      expect(box).toBeChecked();
      expect(screen.getByTestId('policy-check', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled();
      expect(flat(screen.getByTestId('policy-box')).borderColor).toBe(palette(mode).primary);
    },
  );

  renderInBothModes('3.2 los errores del formulario se ven con ícono y texto', async () => {
    await render(<Register />);
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Acepto la política de tratamiento de datos' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() =>
      expect(
        screen.getAllByTestId('field-error-icon', { includeHiddenElements: true }).length,
      ).toBeGreaterThanOrEqual(1),
    );
  });

  renderInBothModes('3.2 iniciar sesión: mismos campos, errores y vínculos', async (mode) => {
    await render(<Login />);
    expect(screen.getByRole('heading', { name: 'Entra a tu cuenta' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
    expect(screen.getByLabelText('Correo')).toBeTruthy();
    expect(screen.getByLabelText('Contraseña')).toBeTruthy();
    expect(flat(screen.getByRole('button', { name: 'Entrar' })).backgroundColor).toBe(
      palette(mode).primary,
    );
    for (const name of ['Olvidé mi contraseña', 'Crear una cuenta']) {
      expect(Number(flat(screen.getByRole('link', { name })).minHeight)).toBeGreaterThanOrEqual(48);
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() =>
      expect(
        screen.getAllByTestId('field-error-icon', { includeHiddenElements: true }).length,
      ).toBeGreaterThanOrEqual(1),
    );
  });

  renderInBothModes('3.2 recuperar la contraseña conserva su campo y sus botones', async (mode) => {
    await render(<ForgotPassword />);
    expect(screen.getByRole('heading', { name: 'Recupera tu contraseña' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
    expect(screen.getByLabelText('Correo')).toBeTruthy();
    expect(flat(screen.getByRole('button', { name: 'Enviar enlace' })).backgroundColor).toBe(
      palette(mode).primary,
    );
    expect(screen.getByRole('button', { name: 'Volver a entrar' })).toBeTruthy();
    expect(
      flat(screen.getByText('Escribe el correo de tu cuenta y te enviaremos un enlace.')).color,
    ).toBe(palette(mode).text);
  });

  it('sin conexión el aviso se ve con los colores de aviso', async () => {
    useSession.setState({ isOnline: false });
    await render(<Login />);
    expect(screen.getByText('Para entrar necesitas internet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });
});

describe('los cinco pasos del onboarding muestran su avance (3.3)', () => {
  const steps: [number, string, () => React.ReactElement][] = [
    [1, '¿Cómo quieres que la IA te llame?', () => <AiName />],
    [2, '¿En qué país estás?', () => <Country />],
    [3, 'Tu ciudad', () => <City />],
    [4, '¿Cuál será tu moneda principal?', () => <Currency />],
    [5, '¿Cómo quieres que trabaje la IA?', () => <AiMode />],
  ];

  for (const [step, , view] of steps) {
    renderInBothModes(
      `paso ${step} de 5: avance, una sola acción principal y sin «Volver»`,
      async (mode) => {
        await render(view());
        expect(screen.getByText(`Paso ${step} de 5`)).toBeTruthy();
        const progress = screen.getByRole('progressbar');
        expect(progress.props.accessibilityValue).toMatchObject({ min: 1, max: 5, now: step });
        const filled = screen.getAllByTestId('step-segment-filled', {
          includeHiddenElements: true,
        });
        expect(filled).toHaveLength(step);
        expect(flat(filled[0] as never).backgroundColor).toBe(palette(mode).primary);

        const wide = screen
          .getAllByRole('button')
          .filter((button) => flat(button).width === '100%');
        expect(wide).toHaveLength(1);
        expect(screen.queryByRole('button', { name: 'Volver' })).toBeNull();
      },
    );
  }

  it('con letra al 150 % el título largo y el avance no se cortan', async () => {
    await withFontScale(1.5, async () => {
      await render(<Country />);
      const title = screen.getByRole('heading', { name: '¿En qué país estás?' });
      expect(title.props.numberOfLines).toBeUndefined();
      expect(screen.getByText('Paso 2 de 5').props.numberOfLines).toBeUndefined();
    });
  });
});
