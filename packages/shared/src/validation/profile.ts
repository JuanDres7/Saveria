import { z } from 'zod';
import { isSupportedCountry } from '../catalog/countries';
import { isSupportedCurrency } from '../catalog/currencies';

export const AI_MODES = ['manual', 'auto'] as const;
export const ONBOARDING_STEPS = [
  'ai_name',
  'country',
  'city',
  'currency',
  'ai_mode',
  'done',
] as const;

export type AiMode = (typeof AI_MODES)[number];
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Texto opcional: se recorta y, si queda vacío, se guarda como `null`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value === '' ? null : value));

const currency = z.string().refine(isSupportedCurrency, 'Moneda no soportada');

export const profileInputSchema = z
  .object({
    aiName: optionalText(30),
    countryCode: z.string().refine(isSupportedCountry, 'País no soportado').nullable(),
    city: optionalText(80),
    primaryCurrency: currency.nullable(),
    referenceCurrencies: z
      .array(currency)
      .max(2, 'Máximo 2 monedas de referencia')
      .refine((codes) => new Set(codes).size === codes.length, 'Monedas de referencia repetidas'),
    aiMode: z.enum(AI_MODES),
    onboardingStep: z.enum(ONBOARDING_STEPS),
  })
  .refine(
    (profile) =>
      profile.primaryCurrency === null ||
      !profile.referenceCurrencies.includes(profile.primaryCurrency),
    {
      message: 'Una moneda de referencia no puede ser la moneda principal',
      path: ['referenceCurrencies'],
    },
  );

export type ProfileInput = z.infer<typeof profileInputSchema>;
