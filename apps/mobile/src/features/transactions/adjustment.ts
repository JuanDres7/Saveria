import { currencyDecimals, fromE4, parseAmount, toE4 } from '@saveria/shared';

export type AdjustmentPreview =
  /** El saldo real que escribió el usuario no es un monto válido */
  | { status: 'invalid'; error: string }
  /** Coincide con el saldo actual: no hay nada que ajustar (6.3) */
  | { status: 'same' }
  /** La diferencia exacta con signo: lo que se suma o se resta al saldo (6.1) */
  | { status: 'diff'; difference: string };

/**
 * Compara el saldo real que escribe el usuario con el saldo que muestra Saveria. La resta es
 * exacta, con enteros en diezmilésimas, nunca con punto flotante (Constitución IV). El saldo real
 * puede ser negativo o cero.
 */
export function previewAdjustment(
  currentBalance: string,
  realBalanceText: string,
  currency: string,
): AdjustmentPreview {
  const real = parseAmount(realBalanceText, currency, { allowNegative: true, allowZero: true });
  if (!real.ok) return { status: 'invalid', error: real.error };
  const difference = toE4(real.value) - toE4(currentBalance);
  if (difference === 0n) return { status: 'same' };
  return { status: 'diff', difference: withCurrencyDecimals(fromE4(difference), currency) };
}

/** Rellena los decimales de la moneda, como el resto de los montos guardados ("-2.5" → "-2.50"). */
function withCurrencyDecimals(amount: string, currency: string): string {
  const decimals = currencyDecimals(currency);
  if (decimals === 0) return amount;
  const [int = '0', dec = ''] = amount.split('.');
  return `${int}.${dec.padEnd(decimals, '0')}`;
}
