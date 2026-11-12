import { formatAmount } from '@saveria/shared';

/** Signo menos tipográfico (U+2212): del ancho de una cifra, como en la maqueta aprobada. */
export const MINUS = '−';

/** Un monto para mostrar: el formato de siempre, con el signo menos tipográfico si es negativo. */
export function formatMoney(amount: string, currency: string): string {
  return formatAmount(amount, currency).replace(/^-/, MINUS);
}
