import { darkColors, lightColors } from '../src/theme/palettes';

// La app no incluye los tipos de Node (rompen los de `fetch`), así que se declaran solo los usados.
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = require('node:fs') as {
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: 'utf8'): string;
  statSync(path: string): { isDirectory(): boolean };
};
const { join, relative, sep } = require('node:path') as {
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
  sep: string;
};

const SRC = join(__dirname, '..', 'src');
const PALETTES = ['theme', 'palettes.ts'].join(sep);
// Archivo generado que no es código de la app.
const GENERATED = ['api', 'schema.d.ts'].join(sep);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(SRC)
  .map((path) => ({ name: relative(SRC, path), text: readFileSync(path, 'utf8') }))
  .filter(({ name }) => name !== PALETTES && name !== GENERATED);

describe('colores en un solo lugar (FR-007, SC-007)', () => {
  it('ningún archivo fuera de theme/palettes.ts escribe un color', () => {
    const hex = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])/;
    const functional = /\brgba?\(/;
    const offenders = files
      .filter(({ text }) => hex.test(text) || functional.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it('las dos paletas tienen exactamente los mismos tokens', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  it('cada color es un #rrggbb', () => {
    for (const palette of [lightColors, darkColors]) {
      for (const value of Object.values(palette)) expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('ya no quedan los nombres provisionales de antes del rediseño', () => {
    const offenders = files
      .filter(({ text }) => /\b(legacyColors|primarySoft|textStrong)\b|\bradius\.md\b/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it('ninguna pantalla importa la paleta fija `colors` ni los estilos fijos de antes del rediseño', () => {
    const offenders = files
      .filter(
        ({ text }) =>
          /import \{[^}]*\bcolors\b[^}]*\} from '[^']*\/theme'/.test(text) ||
          /import \{[^}]*\bstyles\b[^}]*\} from '[^']*auth\/components'/.test(text),
      )
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it('los íconos se importan solo desde `ui/icons.ts`, uno por uno: el índice de lucide infla el paquete', () => {
    const offenders = files
      .filter(({ name }) => !name.endsWith(['ui', 'icons.ts'].join(sep)))
      .filter(({ text }) =>
        /^(import|export)\s+(?!type\b)[^;]*from 'lucide-react-native'/m.test(text),
      )
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });
});

describe('react-native-svg sin red (constitución v1.2.0, condición 2)', () => {
  it('ningún archivo usa SvgUri, SvgCssUri, SvgCss ni SvgXml, que descargan o interpretan imágenes', () => {
    const offenders = files
      .filter(({ text }) => /\b(SvgUri|SvgCssUri|SvgCss|SvgXml)\b/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });
});
