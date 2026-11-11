import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import {
  Banner,
  Field,
  PrimaryButton,
  RadioOption,
  Screen,
  TextButton,
} from '../src/features/auth/components';
import { Chip } from '../src/features/transactions/Chip';
import { darkColors, lightColors } from '../src/theme/palettes';
import { renderInBothModes, withFontScale } from './support/color-scheme';

const palette = (mode: 'light' | 'dark') => (mode === 'light' ? lightColors : darkColors);
const flat = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;
const DISPLAY_FONT = 'BricolageGrotesque';

describe('PrimaryButton (FR-003)', () => {
  renderInBothModes(
    'es ancho, de verde de acción, con texto claro y de al menos 48 dp',
    async (mode) => {
      const onPress = jest.fn();
      await render(<PrimaryButton label="Guardar" onPress={onPress} />);
      const button = screen.getByRole('button', { name: 'Guardar' });
      expect(flat(button)).toMatchObject({ width: '100%', backgroundColor: palette(mode).primary });
      expect(Number(flat(button).minHeight)).toBeGreaterThanOrEqual(48);
      expect(flat(screen.getByText('Guardar')).color).toBe(palette(mode).onPrimary);
      await fireEvent.press(button);
      expect(onPress).toHaveBeenCalledTimes(1);
    },
  );

  renderInBothModes('deshabilitado no actúa y cambia de color', async (mode) => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Guardar" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(flat(button).backgroundColor).toBe(palette(mode).disabled);
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TextButton', () => {
  renderInBothModes('se ve distinto del principal y mide al menos 48 dp', async (mode) => {
    await render(<TextButton label="Ya tengo cuenta" onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Ya tengo cuenta' });
    expect(Number(flat(button).minHeight)).toBeGreaterThanOrEqual(48);
    expect(flat(button).backgroundColor).not.toBe(palette(mode).primary);
    expect(flat(screen.getByText('Ya tengo cuenta')).color).toBe(palette(mode).primary);
  });
});

describe('Field (FR-026)', () => {
  renderInBothModes('la etiqueta es su nombre accesible y mide al menos 48 dp', async (mode) => {
    await render(<Field label="Correo" value="" onChangeText={jest.fn()} />);
    const input = screen.getByLabelText('Correo');
    expect(Number(flat(input).minHeight)).toBeGreaterThanOrEqual(48);
    expect(flat(input).borderColor).toBe(palette(mode).border);
    expect(screen.queryByTestId('field-error-icon', { includeHiddenElements: true })).toBeNull();
  });

  renderInBothModes('con error muestra texto e ícono, no solo color', async (mode) => {
    await render(
      <Field label="Correo" error="Escribe un correo válido" value="" onChangeText={jest.fn()} />,
    );
    expect(screen.getByText('Escribe un correo válido')).toBeTruthy();
    expect(screen.getByTestId('field-error-icon', { includeHiddenElements: true })).toBeTruthy();
    expect(flat(screen.getByLabelText('Correo')).borderColor).toBe(palette(mode).negative);
    expect(flat(screen.getByText('Escribe un correo válido')).color).toBe(palette(mode).negative);
  });
});

describe('RadioOption', () => {
  renderInBothModes('conserva rol y estado, y marca la elegida con borde y fondo', async (mode) => {
    await render(
      <>
        <RadioOption
          label="Manual"
          description="Confirmas cada acción"
          checked
          onPress={jest.fn()}
        />
        <RadioOption label="Automático" checked={false} onPress={jest.fn()} />
        <RadioOption label="Acepto" role="checkbox" checked onPress={jest.fn()} />
      </>,
    );
    const colors = palette(mode);
    const manual = screen.getByRole('radio', { name: 'Manual' });
    expect(manual).toBeChecked();
    expect(screen.getByText('Confirmas cada acción')).toBeTruthy();
    expect(flat(manual)).toMatchObject({
      borderColor: colors.primary,
      backgroundColor: colors.sage,
    });
    expect(Number(flat(manual).minHeight)).toBeGreaterThanOrEqual(48);
    expect(screen.getByRole('radio', { name: 'Automático' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Acepto' })).toBeTruthy();
  });

  renderInBothModes('la elegida lleva una marca visible además del color', async () => {
    await render(<RadioOption label="Manual" checked onPress={jest.fn()} />);
    expect(screen.getByTestId('option-check', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('Chip', () => {
  renderInBothModes('es una píldora con área de toque de al menos 48 dp', async (mode) => {
    const onPress = jest.fn();
    await render(
      <>
        <Chip label="Gasto" checked onPress={onPress} />
        <Chip label="Ingreso" checked={false} onPress={jest.fn()} />
      </>,
    );
    const colors = palette(mode);
    const on = screen.getByRole('radio', { name: 'Gasto' });
    const off = screen.getByRole('radio', { name: 'Ingreso' });
    expect(on).toBeChecked();
    expect(flat(on)).toMatchObject({ backgroundColor: colors.primary, borderRadius: 999 });
    expect(flat(off).backgroundColor).toBe(colors.surfaceSoft);
    expect(flat(screen.getByText('Gasto')).color).toBe(colors.onPrimary);
    const slop = (on.props.hitSlop ?? {}) as { top?: number; bottom?: number };
    expect(
      Number(flat(on).minHeight ?? flat(on).height) + (slop.top ?? 0) + (slop.bottom ?? 0),
    ).toBeGreaterThanOrEqual(48);
    await fireEvent.press(on);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('el nombre accesible puede ser distinto del texto', async () => {
    await render(
      <Chip label="Nequi" accessibilityLabel="Hacia Nequi" checked={false} onPress={jest.fn()} />,
    );
    expect(screen.getByRole('radio', { name: 'Hacia Nequi' })).toBeTruthy();
  });
});

describe('Banner', () => {
  renderInBothModes('usa los colores de aviso del modo', async (mode) => {
    await render(<Banner message="Confirma tu correo" />);
    const text = screen.getByText('Confirma tu correo');
    expect(flat(text).color).toBe(palette(mode).warningText);
    expect(flat(screen.getByTestId('banner')).backgroundColor).toBe(
      palette(mode).warningBackground,
    );
  });
});

describe('Screen y tipografía (FR-004)', () => {
  renderInBothModes(
    'el título es un encabezado en la letra de identidad y el texto usa la del sistema',
    async (mode) => {
      await render(
        <Screen title="Bienvenido a Saveria">
          <Text>Cuéntale a Saveria tus gastos.</Text>
          <Banner message="Aviso" />
        </Screen>,
      );
      const title = screen.getByRole('heading', { name: 'Bienvenido a Saveria' });
      expect(flat(title).fontFamily).toBe(DISPLAY_FONT);
      expect(flat(title).color).toBe(palette(mode).text);
      expect(flat(screen.getByText('Aviso')).fontFamily).toBeUndefined();
      expect(screen.getByTestId('screen-background')).toBeTruthy();
    },
  );
});

describe('letra al 150 % (SC-005)', () => {
  it('ningún texto limita su tamaño ni sus líneas', async () => {
    await withFontScale(1.5, async () => {
      await render(
        <Screen title="Crea tu cuenta con un título bastante largo">
          <Field
            label="Correo electrónico"
            error="Escribe un correo válido"
            value=""
            onChangeText={jest.fn()}
          />
          <RadioOption
            label="Restaurantes y domicilios"
            description="Comida fuera de casa"
            checked
            onPress={jest.fn()}
          />
          <Chip label="Restaurantes y domicilios" checked={false} onPress={jest.fn()} />
          <Banner message="Confirma tu correo" />
          <PrimaryButton label="Continuar" onPress={jest.fn()} />
          <TextButton label="Ya tengo cuenta" onPress={jest.fn()} />
        </Screen>,
      );
      for (const text of screen.getAllByText(/.+/)) {
        expect(text.props.numberOfLines).toBeUndefined();
        expect(text.props.allowFontScaling).not.toBe(false);
        expect(text.props.maxFontSizeMultiplier).toBeUndefined();
      }
    });
  });
});
