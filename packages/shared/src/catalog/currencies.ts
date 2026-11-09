export type CurrencyCode =
  | 'ARS'
  | 'BOB'
  | 'BRL'
  | 'CLP'
  | 'COP'
  | 'CRC'
  | 'CUP'
  | 'DOP'
  | 'GTQ'
  | 'HNL'
  | 'MXN'
  | 'NIO'
  | 'PAB'
  | 'PEN'
  | 'PYG'
  | 'UYU'
  | 'VES'
  | 'USD'
  | 'EUR';

export interface Currency {
  /** ISO 4217 */
  code: CurrencyCode;
  name: string;
  symbol: string;
  /** Decimales con los que se muestra y se guarda el monto */
  decimals: 0 | 2;
}

export const CURRENCIES: readonly Currency[] = [
  { code: 'ARS', name: 'Peso argentino', symbol: '$', decimals: 2 },
  { code: 'BOB', name: 'Boliviano', symbol: 'Bs', decimals: 2 },
  { code: 'BRL', name: 'Real brasileño', symbol: 'R$', decimals: 2 },
  { code: 'CLP', name: 'Peso chileno', symbol: '$', decimals: 0 },
  { code: 'COP', name: 'Peso colombiano', symbol: '$', decimals: 0 },
  { code: 'CRC', name: 'Colón costarricense', symbol: '₡', decimals: 2 },
  { code: 'CUP', name: 'Peso cubano', symbol: '$', decimals: 2 },
  { code: 'DOP', name: 'Peso dominicano', symbol: 'RD$', decimals: 2 },
  { code: 'GTQ', name: 'Quetzal', symbol: 'Q', decimals: 2 },
  { code: 'HNL', name: 'Lempira', symbol: 'L', decimals: 2 },
  { code: 'MXN', name: 'Peso mexicano', symbol: '$', decimals: 2 },
  { code: 'NIO', name: 'Córdoba', symbol: 'C$', decimals: 2 },
  { code: 'PAB', name: 'Balboa', symbol: 'B/.', decimals: 2 },
  { code: 'PEN', name: 'Sol peruano', symbol: 'S/', decimals: 2 },
  { code: 'PYG', name: 'Guaraní', symbol: '₲', decimals: 0 },
  { code: 'UYU', name: 'Peso uruguayo', symbol: '$U', decimals: 2 },
  { code: 'VES', name: 'Bolívar', symbol: 'Bs.S', decimals: 2 },
  { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
];

const CURRENCY_CODES: ReadonlySet<string> = new Set(CURRENCIES.map((c) => c.code));

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return CURRENCY_CODES.has(code);
}
