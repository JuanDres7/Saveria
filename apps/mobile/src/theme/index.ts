/**
 * Tema de Saveria: dos paletas (clara y oscura) que siguen el modo del teléfono. Las pantallas piden
 * el tema con `useTheme()` y sus estilos con `useStyles()`; ninguna escribe un color (FR-007).
 */
import { useColorScheme, type ViewStyle } from 'react-native';
import { darkColors, legacyColors, lightColors, type ThemeColors } from './palettes';
import { DISPLAY_FONT, icon, radius, shadowStyle, space, touch, type } from './tokens';

export type { ThemeColors } from './palettes';
export { DISPLAY_FONT, icon, radius, space, touch, type } from './tokens';

export type Scheme = 'light' | 'dark';

export interface Theme {
  scheme: Scheme;
  colors: ThemeColors;
  radius: typeof radius;
  space: typeof space;
  touch: number;
  icon: typeof icon;
  type: typeof type;
  fonts: { display: string };
  /** Las dos únicas sombras de la app */
  shadow: { hero: ViewStyle; fab: ViewStyle };
}

function buildTheme(scheme: Scheme): Theme {
  const colors = scheme === 'dark' ? darkColors : lightColors;
  return {
    scheme,
    colors,
    radius,
    space,
    touch,
    icon,
    type,
    fonts: { display: DISPLAY_FONT },
    shadow: {
      hero: shadowStyle(colors.shadow, scheme, 'hero'),
      fab: shadowStyle(colors.shadow, scheme, 'fab'),
    },
  };
}

// Un objeto por modo, creado una sola vez: así `useTheme()` devuelve siempre el mismo y los estilos
// memorizados no se rehacen mientras el modo no cambie.
const themes: Record<Scheme, Theme> = { light: buildTheme('light'), dark: buildTheme('dark') };

/** El tema del modo actual del teléfono. Si el sistema no informa modo, es el claro. */
export function useTheme(): Theme {
  return themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

const styleCache = new WeakMap<(theme: Theme) => unknown, Partial<Record<Scheme, unknown>>>();

/**
 * Estilos de una pantalla o pieza, memorizados por modo. `factory` va definida FUERA del componente
 * (a nivel de archivo) y se llama una vez por modo:
 *
 *   const makeStyles = (t: Theme) => StyleSheet.create({ box: { backgroundColor: t.colors.surface } });
 *   const styles = useStyles(makeStyles);
 */
export function useStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  let byScheme = styleCache.get(factory);
  if (!byScheme) {
    byScheme = {};
    styleCache.set(factory, byScheme);
  }
  if (!(theme.scheme in byScheme)) byScheme[theme.scheme] = factory(theme);
  return byScheme[theme.scheme] as T;
}

/**
 * @deprecated La paleta clara con los nombres de antes del rediseño, para las pantallas que aún no
 * usan `useTheme()`. Se retira en la tarea T061.
 */
export const colors = { ...lightColors, ...legacyColors } as const;
