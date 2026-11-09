import type { CurrencyCode } from './currencies';

export interface Country {
  /** ISO 3166-1 alfa-2; `ZZ` = "Otro" */
  code: string;
  name: string;
  /** Moneda que se preselecciona en el onboarding, o `null` si no hay una conocida */
  suggestedCurrency: CurrencyCode | null;
}

export const COUNTRIES: readonly Country[] = [
  { code: 'AR', name: 'Argentina', suggestedCurrency: 'ARS' },
  { code: 'BO', name: 'Bolivia', suggestedCurrency: 'BOB' },
  { code: 'BR', name: 'Brasil', suggestedCurrency: 'BRL' },
  { code: 'CL', name: 'Chile', suggestedCurrency: 'CLP' },
  { code: 'CO', name: 'Colombia', suggestedCurrency: 'COP' },
  { code: 'CR', name: 'Costa Rica', suggestedCurrency: 'CRC' },
  { code: 'CU', name: 'Cuba', suggestedCurrency: 'CUP' },
  { code: 'DO', name: 'República Dominicana', suggestedCurrency: 'DOP' },
  { code: 'EC', name: 'Ecuador', suggestedCurrency: 'USD' },
  { code: 'SV', name: 'El Salvador', suggestedCurrency: 'USD' },
  { code: 'GT', name: 'Guatemala', suggestedCurrency: 'GTQ' },
  { code: 'HN', name: 'Honduras', suggestedCurrency: 'HNL' },
  { code: 'MX', name: 'México', suggestedCurrency: 'MXN' },
  { code: 'NI', name: 'Nicaragua', suggestedCurrency: 'NIO' },
  { code: 'PA', name: 'Panamá', suggestedCurrency: 'PAB' },
  { code: 'PY', name: 'Paraguay', suggestedCurrency: 'PYG' },
  { code: 'PE', name: 'Perú', suggestedCurrency: 'PEN' },
  { code: 'UY', name: 'Uruguay', suggestedCurrency: 'UYU' },
  { code: 'VE', name: 'Venezuela', suggestedCurrency: 'VES' },
  { code: 'US', name: 'Estados Unidos', suggestedCurrency: 'USD' },
  { code: 'ES', name: 'España', suggestedCurrency: 'EUR' },
  { code: 'ZZ', name: 'Otro', suggestedCurrency: null },
];

const COUNTRY_BY_CODE: ReadonlyMap<string, Country> = new Map(COUNTRIES.map((c) => [c.code, c]));

export function isSupportedCountry(code: string): boolean {
  return COUNTRY_BY_CODE.has(code);
}

export function suggestedCurrencyFor(countryCode: string): CurrencyCode | null {
  return COUNTRY_BY_CODE.get(countryCode)?.suggestedCurrency ?? null;
}
