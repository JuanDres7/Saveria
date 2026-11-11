/**
 * Las dos paletas de Saveria, el ÚNICO archivo de la app con colores (FR-007). Cada color se llama
 * por lo que significa, no por cómo se ve, y las dos paletas tienen exactamente los mismos nombres:
 * el tipo `ThemeColors` obliga a eso. Valores y contrastes: specs/003-visual-redesign/data-model.md.
 */
export interface ThemeColors {
  /** Fondo de pantalla */
  background: string;
  /** Lámina de contenido, barra inferior y formularios */
  surface: string;
  /** Chips, cuentas, campos y transferencias */
  surfaceSoft: string;
  /** Forma de fondo, círculo de categoría base e ítem activo de la barra */
  sage: string;
  /** Botón principal, ítem activo, chip elegido, enlaces y botón «+» */
  primary: string;
  /** Texto e ícono sobre `primary` */
  onPrimary: string;
  /** Tarjeta de balance y parte superior de la bienvenida */
  hero: string;
  /** Hoja y nervaduras dentro de `hero` (solo decorativo) */
  heroShape: string;
  /** Texto principal sobre `hero` */
  onHero: string;
  /** Texto secundario sobre `hero` */
  onHeroMuted: string;
  /** Texto principal y montos de gastos */
  text: string;
  /** Texto secundario y ayudas */
  textMuted: string;
  /** Borde de campos y controles */
  border: string;
  /** Líneas que separan filas */
  divider: string;
  /** Controles inactivos */
  disabled: string;
  /** SOLO saldos negativos y errores */
  negative: string;
  /** Ingresos, con signo «+» */
  positive: string;
  /** Aviso (por ejemplo, confirma tu correo) */
  warningBackground: string;
  warningText: string;
  /** Aviso flotante «Deshacer» y su texto */
  inverse: string;
  onInverse: string;
  /** Sombra de la tarjeta de balance y del botón «+» */
  shadow: string;
  /** Círculos de categoría: comida y compras */
  toneSand: string;
  toneSandInk: string;
  /** Círculos de categoría: movilidad y viajes */
  toneMist: string;
  toneMistInk: string;
  /** Círculos de categoría: salud y personas */
  toneClay: string;
  toneClayInk: string;
}

export const lightColors: ThemeColors = {
  background: '#F6F3EA',
  surface: '#FCFBF7',
  surfaceSoft: '#ECE9D8',
  sage: '#DDE2C8',
  primary: '#3F4A28',
  onPrimary: '#FCFBF7',
  hero: '#3F4A28',
  heroShape: '#4E5B33',
  onHero: '#F6F3EA',
  onHeroMuted: '#CDD4B4',
  text: '#1F2616',
  textMuted: '#575E45',
  border: '#7D8468',
  divider: '#E3DFCB',
  disabled: '#8A8F78',
  negative: '#A63A24',
  positive: '#2F6B2A',
  warningBackground: '#F6E7B8',
  warningText: '#5C4310',
  inverse: '#2B3320',
  onInverse: '#F6F3EA',
  shadow: '#3F4A28',
  toneSand: '#F1E4C3',
  toneSandInk: '#6B4E12',
  toneMist: '#D5E4DC',
  toneMistInk: '#2B5646',
  toneClay: '#F3DACF',
  toneClayInk: '#8A3A24',
};

export const darkColors: ThemeColors = {
  background: '#14180F',
  surface: '#1D2217',
  surfaceSoft: '#272D1F',
  sage: '#2F3A24',
  primary: '#B9C78C',
  onPrimary: '#1A2010',
  hero: '#2C3720',
  heroShape: '#394728',
  onHero: '#ECEBDD',
  onHeroMuted: '#B7BEA0',
  text: '#ECEBDD',
  textMuted: '#B1B69F',
  border: '#7E8568',
  divider: '#2C3322',
  disabled: '#5A604B',
  negative: '#F0A493',
  positive: '#A5D68A',
  warningBackground: '#3B3217',
  warningText: '#F3DFA2',
  inverse: '#ECEBDD',
  onInverse: '#14180F',
  shadow: '#000000',
  toneSand: '#3A321C',
  toneSandInk: '#E6C987',
  toneMist: '#223129',
  toneMistInk: '#A9CDB9',
  toneClay: '#402A22',
  toneClayInk: '#F0B4A2',
};

/**
 * Nombres que usaban las pantallas antes del rediseño. Son alias de colores que ya existen, no
 * colores nuevos, y se retiran cuando todas las pantallas usen `useTheme()` (tarea T061).
 */
export const legacyColors = {
  primarySoft: lightColors.sage,
  textStrong: lightColors.text,
} as const;
