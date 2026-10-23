import { describe, expect, it } from 'bun:test';
import {
  COUNTRIES,
  CURRENCIES,
  emailSchema,
  isSupportedCountry,
  isSupportedCurrency,
  PRIVACY_POLICY_PATH,
  PRIVACY_POLICY_VERSION,
  passwordSchema,
  profileInputSchema,
  suggestedCurrencyFor,
} from '../src';

const validProfile = {
  aiName: 'Juan',
  countryCode: 'CO',
  city: 'Barranquilla',
  primaryCurrency: 'COP',
  referenceCurrencies: ['USD'],
  aiMode: 'manual',
  onboardingStep: 'ai_mode',
};

describe('catálogo de monedas', () => {
  it('contiene exactamente las 19 monedas del MVP', () => {
    const codes: string[] = CURRENCIES.map((c) => c.code);
    expect(codes.sort()).toEqual(
      [
        'ARS',
        'BOB',
        'BRL',
        'CLP',
        'COP',
        'CRC',
        'CUP',
        'DOP',
        'EUR',
        'GTQ',
        'HNL',
        'MXN',
        'NIO',
        'PAB',
        'PEN',
        'PYG',
        'USD',
        'UYU',
        'VES',
      ].sort(),
    );
  });

  it('CLP y PYG no tienen decimales; el resto tiene 2', () => {
    for (const c of CURRENCIES) {
      expect(c.decimals).toBe(c.code === 'CLP' || c.code === 'PYG' ? 0 : 2);
    }
  });

  it('isSupportedCurrency distingue monedas soportadas', () => {
    expect(isSupportedCurrency('COP')).toBe(true);
    expect(isSupportedCurrency('JPY')).toBe(false);
    expect(isSupportedCurrency('cop')).toBe(false);
  });
});

describe('catálogo de países', () => {
  it('2.2 Colombia sugiere COP', () => {
    expect(suggestedCurrencyFor('CO')).toBe('COP');
  });

  it('ZZ (Otro) no sugiere ninguna moneda', () => {
    expect(suggestedCurrencyFor('ZZ')).toBeNull();
  });

  it('un país desconocido no sugiere ninguna moneda', () => {
    expect(suggestedCurrencyFor('XX')).toBeNull();
  });

  it('Estados Unidos y España sugieren USD y EUR', () => {
    expect(suggestedCurrencyFor('US')).toBe('USD');
    expect(suggestedCurrencyFor('ES')).toBe('EUR');
  });

  it('toda moneda sugerida existe en el catálogo de monedas', () => {
    for (const country of COUNTRIES) {
      if (country.suggestedCurrency !== null) {
        expect(isSupportedCurrency(country.suggestedCurrency)).toBe(true);
      }
    }
  });

  it('isSupportedCountry reconoce los códigos del catálogo', () => {
    expect(isSupportedCountry('CO')).toBe(true);
    expect(isSupportedCountry('ZZ')).toBe(true);
    expect(isSupportedCountry('XX')).toBe(false);
  });
});

describe('política de datos', () => {
  it('expone la versión vigente y su ruta', () => {
    expect(PRIVACY_POLICY_VERSION).toBe('2026-10-v1');
    expect(PRIVACY_POLICY_PATH).toBe('/legal/privacy');
  });
});

describe('emailSchema', () => {
  it('normaliza espacios y mayúsculas', () => {
    expect(emailSchema.parse('  Ana@Mail.com ')).toBe('ana@mail.com');
  });

  it('rechaza formatos inválidos', () => {
    expect(emailSchema.safeParse('ana@').success).toBe(false);
    expect(emailSchema.safeParse('sin-arroba').success).toBe(false);
    expect(emailSchema.safeParse('').success).toBe(false);
  });

  it('rechaza correos de más de 254 caracteres', () => {
    expect(emailSchema.safeParse(`${'a'.repeat(250)}@mail.com`).success).toBe(false);
  });
});

describe('passwordSchema (FR-003)', () => {
  it('acepta una contraseña con letra y número', () => {
    expect(passwordSchema.safeParse('clave1234').success).toBe(true);
  });

  it('rechaza contraseñas sin número', () => {
    expect(passwordSchema.safeParse('clavelarga').success).toBe(false);
  });

  it('rechaza contraseñas sin letra', () => {
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
  });

  it('rechaza contraseñas de menos de 8 caracteres', () => {
    expect(passwordSchema.safeParse('clave12').success).toBe(false);
  });

  it('acepta exactamente 8 caracteres', () => {
    expect(passwordSchema.safeParse('clave123').success).toBe(true);
  });

  it('acepta letras con tilde y ñ', () => {
    expect(passwordSchema.safeParse('contraseña1').success).toBe(true);
  });

  it('rechaza más de 1024 caracteres', () => {
    expect(passwordSchema.safeParse(`a1${'x'.repeat(1023)}`).success).toBe(false);
  });
});

describe('profileInputSchema', () => {
  it('acepta un perfil válido', () => {
    expect(profileInputSchema.safeParse(validProfile).success).toBe(true);
  });

  it('FR-017 un nombre vacío o solo espacios se guarda como null', () => {
    expect(profileInputSchema.parse({ ...validProfile, aiName: '' }).aiName).toBeNull();
    expect(profileInputSchema.parse({ ...validProfile, aiName: '   ' }).aiName).toBeNull();
  });

  it('FR-017 recorta el nombre y acepta hasta 30 caracteres', () => {
    expect(profileInputSchema.parse({ ...validProfile, aiName: '  Ana  ' }).aiName).toBe('Ana');
    expect(profileInputSchema.safeParse({ ...validProfile, aiName: 'a'.repeat(30) }).success).toBe(
      true,
    );
  });

  it('FR-017 rechaza un nombre de más de 30 caracteres', () => {
    expect(profileInputSchema.safeParse({ ...validProfile, aiName: 'a'.repeat(31) }).success).toBe(
      false,
    );
  });

  it('la ciudad admite hasta 80 caracteres y vacía pasa a null', () => {
    expect(profileInputSchema.safeParse({ ...validProfile, city: 'a'.repeat(81) }).success).toBe(
      false,
    );
    expect(profileInputSchema.parse({ ...validProfile, city: ' ' }).city).toBeNull();
  });

  it('rechaza un país fuera del catálogo', () => {
    expect(profileInputSchema.safeParse({ ...validProfile, countryCode: 'XX' }).success).toBe(
      false,
    );
  });

  it('rechaza una moneda principal fuera del catálogo', () => {
    expect(profileInputSchema.safeParse({ ...validProfile, primaryCurrency: 'JPY' }).success).toBe(
      false,
    );
  });

  it('permite perfil sin país ni moneda (onboarding en curso)', () => {
    const result = profileInputSchema.safeParse({
      ...validProfile,
      countryCode: null,
      city: null,
      primaryCurrency: null,
      referenceCurrencies: [],
      onboardingStep: 'country',
    });
    expect(result.success).toBe(true);
  });

  it('FR-020 rechaza una moneda de referencia igual a la principal', () => {
    const result = profileInputSchema.safeParse({
      ...validProfile,
      primaryCurrency: 'COP',
      referenceCurrencies: ['COP'],
    });
    expect(result.success).toBe(false);
  });

  it('FR-020 rechaza más de 2 monedas de referencia', () => {
    const result = profileInputSchema.safeParse({
      ...validProfile,
      referenceCurrencies: ['USD', 'EUR', 'MXN'],
    });
    expect(result.success).toBe(false);
  });

  it('FR-020 rechaza monedas de referencia repetidas', () => {
    const result = profileInputSchema.safeParse({
      ...validProfile,
      referenceCurrencies: ['USD', 'USD'],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un modo de IA o un paso de onboarding desconocido', () => {
    expect(profileInputSchema.safeParse({ ...validProfile, aiMode: 'turbo' }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...validProfile, onboardingStep: 'fin' }).success).toBe(
      false,
    );
  });
});
