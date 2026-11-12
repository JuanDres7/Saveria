import { fireEvent, render, screen } from '@testing-library/react-native';
import { House } from 'lucide-react-native';
import { StyleSheet, Text } from 'react-native';
import { darkColors, lightColors } from '../src/theme/palettes';
import { BackButton } from '../src/ui/BackButton';
import { Card } from '../src/ui/Card';
import { CategoryIcon } from '../src/ui/CategoryIcon';
import { Icon } from '../src/ui/Icon';
import { Leaf } from '../src/ui/Leaf';
import { ScreenBackground } from '../src/ui/ScreenBackground';
import { renderInBothModes, setSafeAreaInsets } from './support/color-scheme';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

import { router } from 'expo-router';

const palette = (mode: 'light' | 'dark') => (mode === 'light' ? lightColors : darkColors);
const flat = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;

describe('Icon', () => {
  renderInBothModes(
    'usa el color del texto, 20 dp y queda oculto a lectores de pantalla',
    async (mode) => {
      await render(<Icon icon={House} testID="icon" />);
      const icon = screen.getByTestId('icon', { includeHiddenElements: true });
      expect(icon.props.stroke).toBe(palette(mode).text);
      expect(icon.props.width).toBe(20);
      expect(screen.queryByTestId('icon')).toBeNull();
    },
  );

  renderInBothModes('acepta el color de otro token y un tamaño', async (mode) => {
    await render(<Icon icon={House} color="primary" size={24} testID="icon" />);
    const icon = screen.getByTestId('icon', { includeHiddenElements: true });
    expect(icon.props.stroke).toBe(palette(mode).primary);
    expect(icon.props.width).toBe(24);
  });

  it('con una etiqueta es el único contenido de un control y se anuncia', async () => {
    await render(<Icon icon={House} label="Inicio" />);
    expect(screen.getByLabelText('Inicio')).toBeTruthy();
  });
});

describe('CategoryIcon', () => {
  renderInBothModes('usa el tono de su categoría', async (mode) => {
    await render(
      <>
        <CategoryIcon slug="groceries" testID="arena" />
        <CategoryIcon slug="transport" testID="niebla" />
        <CategoryIcon slug="health" testID="arcilla" />
        <CategoryIcon slug="salary" testID="base" />
        <CategoryIcon slug="no-existe" testID="neutro" />
      </>,
    );
    const colors = palette(mode);
    const background = (id: string) =>
      flat(screen.getByTestId(id, { includeHiddenElements: true })).backgroundColor;
    expect(background('arena')).toBe(colors.toneSand);
    expect(background('niebla')).toBe(colors.toneMist);
    expect(background('arcilla')).toBe(colors.toneClay);
    expect(background('base')).toBe(colors.sage);
    expect(background('neutro')).toBe(colors.surfaceSoft);
  });

  it('es un círculo del tamaño pedido y no se anuncia: el nombre de la categoría va al lado', async () => {
    await render(<CategoryIcon slug="dining" size={32} testID="cat" />);
    expect(screen.queryByTestId('cat')).toBeNull();
    expect(flat(screen.getByTestId('cat', { includeHiddenElements: true }))).toMatchObject({
      width: 32,
      height: 32,
      borderRadius: 16,
    });
  });
});

describe('Leaf (FR-031)', () => {
  renderInBothModes(
    'la tarjeta de balance tiene esquinas 34 y 12 en esquinas opuestas',
    async (mode) => {
      await render(
        <Leaf variant="balance" testID="leaf">
          <Text>Contenido</Text>
        </Leaf>,
      );
      expect(screen.getByText('Contenido')).toBeTruthy();
      expect(flat(screen.getByTestId('leaf'))).toMatchObject({
        backgroundColor: palette(mode).hero,
        borderTopLeftRadius: 34,
        borderBottomRightRadius: 34,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 12,
      });
    },
  );

  renderInBothModes('el botón «+» tiene esquinas 20 y 8 en esquinas opuestas', async (mode) => {
    await render(
      <Leaf variant="fab" testID="leaf">
        <Text>+</Text>
      </Leaf>,
    );
    expect(flat(screen.getByTestId('leaf'))).toMatchObject({
      backgroundColor: palette(mode).primary,
      borderTopLeftRadius: 20,
      borderBottomRightRadius: 20,
      borderTopRightRadius: 8,
      borderBottomLeftRadius: 8,
    });
  });

  it('las nervaduras existen solo en el balance y quedan fuera del orden de foco', async () => {
    await render(
      <>
        <Leaf variant="balance">
          <Text>balance</Text>
        </Leaf>
        <Leaf variant="fab">
          <Text>fab</Text>
        </Leaf>
      </>,
    );
    expect(screen.queryByTestId('leaf-veins')).toBeNull();
    expect(screen.getAllByTestId('leaf-veins', { includeHiddenElements: true })).toHaveLength(1);
  });
});

describe('Card', () => {
  renderInBothModes('es plana, redondeada y no se puede tocar', async (mode) => {
    await render(
      <>
        <Card testID="surface">
          <Text>uno</Text>
        </Card>
        <Card tone="soft" testID="soft">
          <Text>dos</Text>
        </Card>
      </>,
    );
    const colors = palette(mode);
    const surface = screen.getByTestId('surface');
    expect(flat(surface)).toMatchObject({ backgroundColor: colors.surface, borderRadius: 24 });
    expect(flat(screen.getByTestId('soft')).backgroundColor).toBe(colors.surfaceSoft);
    expect(flat(surface).elevation).toBeUndefined();
    expect(flat(surface).shadowOpacity).toBeUndefined();
    expect(surface.props.onPress).toBeUndefined();
  });
});

describe('ScreenBackground', () => {
  renderInBothModes(
    'pinta el fondo y deja el contenido dentro de los márgenes del sistema',
    async (mode) => {
      await render(
        <ScreenBackground testID="screen">
          <Text>contenido</Text>
        </ScreenBackground>,
      );
      expect(screen.getByText('contenido')).toBeTruthy();
      expect(flat(screen.getByTestId('screen'))).toMatchObject({
        backgroundColor: palette(mode).background,
        paddingTop: 24,
        paddingBottom: 16,
      });
    },
  );

  it('con edges=["top"] no suma el margen inferior (la barra inferior lo pone)', async () => {
    await render(
      <ScreenBackground testID="screen" edges={['top']}>
        <Text>contenido</Text>
      </ScreenBackground>,
    );
    expect(flat(screen.getByTestId('screen'))).toMatchObject({ paddingTop: 24, paddingBottom: 0 });
  });

  it('sigue los márgenes del sistema de cada teléfono', async () => {
    setSafeAreaInsets({ top: 40, bottom: 34 });
    await render(
      <ScreenBackground testID="screen">
        <Text>contenido</Text>
      </ScreenBackground>,
    );
    expect(flat(screen.getByTestId('screen'))).toMatchObject({ paddingTop: 40, paddingBottom: 34 });
    setSafeAreaInsets({ top: 24, bottom: 16 });
  });

  it('la forma de fondo no se lee ni entra en el orden de foco', async () => {
    await render(
      <ScreenBackground>
        <Text>contenido</Text>
      </ScreenBackground>,
    );
    expect(screen.queryByTestId('screen-blob')).toBeNull();
    expect(screen.getByTestId('screen-blob', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('BackButton (FR-016)', () => {
  renderInBothModes('es un botón «Volver» de al menos 48 dp que vuelve atrás', async (mode) => {
    (router.back as jest.Mock).mockClear();
    await render(<BackButton />);
    const button = screen.getByRole('button', { name: 'Volver' });
    const style = flat(button);
    expect(Number(style.width)).toBeGreaterThanOrEqual(48);
    expect(Number(style.height)).toBeGreaterThanOrEqual(48);
    expect(style.backgroundColor).toBe(palette(mode).surfaceSoft);
    await fireEvent.press(button);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('acepta su propia acción en lugar de volver', async () => {
    (router.back as jest.Mock).mockClear();
    const onPress = jest.fn();
    await render(<BackButton onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
  });
});
