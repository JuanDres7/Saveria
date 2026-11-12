import { CURRENCIES } from '../catalog/currencies';

/**
 * Dinero exacto (Constitución IV, research §5). Los montos viajan y se guardan como texto decimal;
 * para sumar se pasan a enteros en diezmilésimas (`BigInt`). Nunca se usa `number` para un monto.
 */

/** Máximo de dígitos enteros de un monto (FR-005). */
export const MAX_AMOUNT_INTEGER_DIGITS = 12;

const SCALE = 4;
const E4 = 10n ** BigInt(SCALE);
const DECIMAL_TEXT = /^(-?)(\d+)(?:\.(\d{1,4}))?$/;

/** Decimales permitidos de una moneda del catálogo (2 si no se conoce). */
export function currencyDecimals(currency: string): number {
  return CURRENCIES.find((c) => c.code === currency)?.decimals ?? 2;
}

/** Símbolo de una moneda del catálogo (su código si no se conoce). */
export function currencySymbol(currency: string): string {
  return CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
}

/** Texto decimal (`"-123.45"`) → entero en diezmilésimas. Lanza si el texto no es un decimal. */
export function toE4(text: string): bigint {
  const match = DECIMAL_TEXT.exec(text);
  if (!match) throw new Error(`Monto inválido: ${text}`);
  const [, sign, int, dec = ''] = match;
  const value = BigInt(int) * E4 + BigInt(dec.padEnd(SCALE, '0'));
  return sign === '-' ? -value : value;
}

/** Entero en diezmilésimas → texto decimal mínimo (sin ceros sobrantes a la derecha). */
export function fromE4(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const int = abs / E4;
  const dec = (abs % E4).toString().padStart(SCALE, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${int}${dec ? `.${dec}` : ''}`;
}

/** -1, 0 o 1 según `a` sea menor, igual o mayor que `b`. */
export function compareAmounts(a: string, b: string): -1 | 0 | 1 {
  const x = toE4(a);
  const y = toE4(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Problema con un monto ya en texto decimal, o `null` si cumple las reglas de la moneda. */
export function amountTextError(
  text: string,
  currency: string,
  options: { allowNegative?: boolean; allowZero?: boolean } = {},
): string | null {
  const match = DECIMAL_TEXT.exec(text);
  if (!match) return 'Monto inválido';
  const [, sign, int, dec = ''] = match;
  if (sign === '-' && !options.allowNegative) return 'El monto debe ser mayor que cero';
  if (int.replace(/^0+(?=\d)/, '').length > MAX_AMOUNT_INTEGER_DIGITS) {
    return `El monto puede tener máximo ${MAX_AMOUNT_INTEGER_DIGITS} dígitos enteros`;
  }
  const decimals = currencyDecimals(currency);
  if (dec.replace(/0+$/, '').length > decimals) {
    return decimals === 0
      ? `Los montos en ${currency} van sin decimales`
      : `Los montos en ${currency} tienen máximo ${decimals} decimales`;
  }
  if (!options.allowZero && toE4(text) === 0n) {
    return options.allowNegative
      ? 'El monto no puede ser cero'
      : 'El monto debe ser mayor que cero';
  }
  return null;
}

export type ParseAmountResult = { ok: true; value: string } | { ok: false; error: string };

/**
 * Lo que escribe el usuario → texto decimal canónico con los decimales de la moneda.
 * Estilo colombiano: `.` separa miles y `,` decimales ("18.000", "12,50"). Si no hay coma, un
 * punto que no forma grupos de 3 se toma como decimal ("12.5").
 */
export function parseAmount(
  input: string,
  currency: string,
  options: { allowNegative?: boolean; allowZero?: boolean } = {},
): ParseAmountResult {
  let text = input.replace(/[\s$]/g, '');
  if (text === '') return { ok: false, error: 'Escribe un monto' };

  let sign = '';
  if (text.startsWith('-')) {
    if (!options.allowNegative) return { ok: false, error: 'El monto debe ser mayor que cero' };
    sign = '-';
    text = text.slice(1);
  }

  let int: string;
  let dec = '';
  if (text.includes(',')) {
    const parts = text.split(',');
    if (parts.length !== 2) return { ok: false, error: 'Monto inválido' };
    [int, dec] = parts;
    if (int.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(int)) {
      return { ok: false, error: 'Monto inválido' };
    }
    int = int.replace(/\./g, '');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    int = text.replace(/\./g, '');
  } else if (/^\d*\.\d+$/.test(text)) {
    [int, dec] = text.split('.');
  } else {
    int = text;
  }

  if (int === '') int = '0';
  if (!/^\d+$/.test(int) || !/^\d*$/.test(dec)) return { ok: false, error: 'Monto inválido' };

  const decimals = currencyDecimals(currency);
  const significant = dec.replace(/0+$/, '');
  if (significant.length > decimals) {
    return {
      ok: false,
      error:
        decimals === 0
          ? `Los montos en ${currency} van sin decimales`
          : `Los montos en ${currency} tienen máximo ${decimals} decimales`,
    };
  }

  const normalizedInt = int.replace(/^0+(?=\d)/, '');
  const value = `${sign}${normalizedInt}${decimals > 0 ? `.${significant.padEnd(decimals, '0')}` : ''}`;
  const error = amountTextError(value, currency, {
    allowNegative: options.allowNegative,
    allowZero: true,
  });
  if (error) return { ok: false, error };
  if (toE4(value) === 0n && !options.allowZero) {
    return { ok: false, error: 'El monto debe ser mayor que cero' };
  }
  return { ok: true, value };
}

/** Texto decimal → texto para mostrar al estilo colombiano: "$ 18.000", "US$ 1.234,50". */
export function formatAmount(text: string, currency: string): string {
  const decimals = currencyDecimals(currency);
  const value = toE4(text);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  // Redondeo a los decimales de la moneda, mitad hacia arriba, todo en enteros.
  const step = 10n ** BigInt(SCALE - decimals);
  const rounded = (abs + step / 2n) / step;
  const unit = 10n ** BigInt(decimals);
  const int = (rounded / unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dec = decimals > 0 ? `,${(rounded % unit).toString().padStart(decimals, '0')}` : '';
  return `${negative ? '-' : ''}${currencySymbol(currency)} ${int}${dec}`;
}
