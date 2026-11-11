/**
 * Colores y medidas de la app en un solo lugar. Cada color se llama por lo que significa
 * (`negative`, `primary`…), no por cómo se ve, para poder rediseñar la app cambiando este archivo.
 * Hoy los valores son los provisionales de las primeras pantallas; el rediseño los reemplaza.
 */
export const colors = {
  /** Acción principal: botones, enlaces, opciones elegidas */
  primary: '#0f766e',
  /** Texto e íconos sobre `primary` */
  onPrimary: '#ffffff',
  /** Fondo de una opción elegida */
  primarySoft: '#f0fdfa',

  /** Fondo de barras y paneles fijos */
  surface: '#ffffff',
  /** Borde de campos, opciones y chips */
  border: '#9ca3af',
  /** Línea fina que separa filas y paneles */
  divider: '#e5e7eb',
  /** Botón deshabilitado */
  disabled: '#9ca3af',

  /** Texto principal */
  text: '#111827',
  /** Texto de apoyo: títulos de sección, detalles */
  textStrong: '#374151',
  /** Texto secundario: descripciones, ayudas */
  textMuted: '#4b5563',

  /** Dinero que sale, saldos negativos y errores */
  negative: '#b91c1c',
  /** Dinero que entra */
  positive: '#047857',

  /** Aviso (por ejemplo, confirma tu correo) */
  warningBackground: '#fef3c7',
  warningText: '#78350f',

  /** Aviso flotante oscuro (Deshacer) y su acción */
  inverse: '#1f2937',
  inverseAccent: '#5eead4',
} as const;

/** Radios de las esquinas */
export const radius = {
  /** Campos, botones y tarjetas */
  md: 8,
  /** Chips */
  pill: 16,
} as const;
