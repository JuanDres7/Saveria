import { darkColors, lightColors, type ThemeColors } from '../src/theme/palettes';

/** Contraste WCAG 2.1 entre dos colores `#rrggbb`. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

type Token = keyof ThemeColors;
type Pair = [foreground: Token, background: Token, minimum: number];

const TEXT = 4.5;
const GRAPHIC = 3;

// Los pares y sus mínimos salen de la tabla de contraste de specs/003-visual-redesign/data-model.md.
const pairs: Pair[] = [
  ['text', 'background', TEXT],
  ['text', 'surface', TEXT],
  ['text', 'surfaceSoft', TEXT],
  ['textMuted', 'background', TEXT],
  ['textMuted', 'surface', TEXT],
  ['textMuted', 'surfaceSoft', TEXT],
  ['onPrimary', 'primary', TEXT],
  ['primary', 'background', TEXT],
  ['primary', 'surface', TEXT],
  ['primary', 'sage', TEXT],
  ['onHero', 'hero', TEXT],
  ['onHero', 'heroShape', TEXT],
  ['onHeroMuted', 'hero', TEXT],
  ['onHeroMuted', 'heroShape', TEXT],
  ['negative', 'background', TEXT],
  ['negative', 'surface', TEXT],
  ['negative', 'surfaceSoft', TEXT],
  ['positive', 'background', TEXT],
  ['positive', 'surface', TEXT],
  ['positive', 'surfaceSoft', TEXT],
  ['warningText', 'warningBackground', TEXT],
  ['onInverse', 'inverse', TEXT],
  ['border', 'background', GRAPHIC],
  ['border', 'surface', GRAPHIC],
  ['toneSandInk', 'toneSand', GRAPHIC],
  ['toneMistInk', 'toneMist', GRAPHIC],
  ['toneClayInk', 'toneClay', GRAPHIC],
];

describe.each([
  ['modo claro', lightColors],
  ['modo oscuro', darkColors],
])('contraste de la paleta en %s (FR-029, SC-002)', (_name, palette) => {
  it.each(pairs)('%s sobre %s llega a %s:1', (foreground, background, minimum) => {
    expect(contrast(palette[foreground], palette[background])).toBeGreaterThanOrEqual(minimum);
  });
});
