import type { TextStyle, ViewStyle } from 'react-native';

/** Familia de la letra de identidad. Se incrusta al compilar (plugin `expo-font` en app.json). */
export const DISPLAY_FONT = 'BricolageGrotesque';

/** Radios de las esquinas. Ver «Medidas» en specs/003-visual-redesign/data-model.md. */
export const radius = {
  /** Tarjeta de balance: esquinas grandes y esquinas pequeñas, en esquinas opuestas */
  leaf: 34,
  leafSmall: 12,
  /** Botón «+»: la misma forma, más pequeña */
  fab: 20,
  fabSmall: 8,
  /** Lámina de contenido: solo las esquinas de arriba */
  sheet: 26,
  card: 24,
  control: 16,
  pill: 999,
  /** @deprecated Radio de las pantallas anteriores al rediseño; se retira con el resto de lo provisional (T061) */
  md: 8,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** Tamaño mínimo del área de toque */
export const touch = 48;

/** Íconos: tamaño por lugar y grosor del trazo */
export const icon = { row: 20, bar: 24, fab: 23, stroke: 1.75, fabStroke: 2 } as const;

/**
 * Escala de texto. Títulos y cifras grandes usan la letra de identidad; todo lo demás, la del
 * sistema (FR-004). Los montos de las listas llevan cifras tabulares para que alineen.
 */
export const type = {
  title: { fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: '700' },
  subtitle: { fontFamily: DISPLAY_FONT, fontSize: 17, fontWeight: '600' },
  figure: { fontFamily: DISPLAY_FONT, fontSize: 34, fontWeight: '700' },
  amountInput: { fontFamily: DISPLAY_FONT, fontSize: 44, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  amount: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  caption: { fontSize: 13, fontWeight: '400' },
} as const satisfies Record<string, TextStyle>;

/** Sombra de la tarjeta de balance y del botón «+»: las dos únicas de la app. El color sale del tema. */
export function shadowStyle(
  color: string,
  scheme: 'light' | 'dark',
  size: 'hero' | 'fab',
): ViewStyle {
  const strong = scheme === 'dark';
  const big = size === 'hero';
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: big ? 12 : 8 },
    shadowOpacity: strong ? 0.45 : 0.3,
    shadowRadius: big ? 22 : 14,
    elevation: big ? 8 : 6,
  };
}
