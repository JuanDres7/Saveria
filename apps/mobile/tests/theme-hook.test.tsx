import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { colors as legacyColorsExport, useStyles, useTheme } from '../src/theme';
import { darkColors, lightColors } from '../src/theme/palettes';
import { renderInBothModes, setColorScheme } from './support/color-scheme';

function Probe() {
  const { scheme, colors } = useTheme();
  return <Text>{`${scheme}:${colors.background}`}</Text>;
}

const seen: object[] = [];
const factory = (theme: ReturnType<typeof useTheme>) => ({
  box: { backgroundColor: theme.colors.surface },
});

function StylesProbe() {
  const styles = useStyles(factory);
  seen.push(styles);
  return <Text style={styles.box}>estilos</Text>;
}

describe('useTheme (FR-027, FR-028)', () => {
  renderInBothModes('devuelve la paleta del modo del teléfono', async (mode) => {
    await render(<Probe />);
    const palette = mode === 'light' ? lightColors : darkColors;
    expect(screen.getByText(`${mode}:${palette.background}`)).toBeTruthy();
  });

  it('si el sistema no informa modo, usa el claro', async () => {
    await setColorScheme(null);
    await render(<Probe />);
    expect(screen.getByText(`light:${lightColors.background}`)).toBeTruthy();
    await setColorScheme('light');
  });

  it('cambiar el modo con la pantalla dibujada la vuelve a dibujar sin desmontarla', async () => {
    await render(<Probe />);
    expect(screen.getByText(/^light:/)).toBeTruthy();
    await setColorScheme('dark');
    expect(screen.getByText(`dark:${darkColors.background}`)).toBeTruthy();
    await setColorScheme('light');
    expect(screen.getByText(`light:${lightColors.background}`)).toBeTruthy();
  });

  it('useStyles memoriza por modo: mismo objeto mientras el modo no cambia', async () => {
    seen.length = 0;
    const { rerender } = await render(<StylesProbe />);
    await rerender(<StylesProbe />);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[0]).toBe(seen[1]);
    await setColorScheme('dark');
    const last = seen[seen.length - 1] as { box: { backgroundColor: string } };
    expect(last).not.toBe(seen[0]);
    expect(last.box.backgroundColor).toBe(darkColors.surface);
    await setColorScheme('light');
  });

  it('mientras se migran las pantallas, `colors` sigue siendo la paleta clara con los nombres viejos', () => {
    expect(legacyColorsExport.primary).toBe(lightColors.primary);
    expect(legacyColorsExport.primarySoft).toBe(lightColors.sage);
    expect(legacyColorsExport.textStrong).toBe(lightColors.text);
  });
});
