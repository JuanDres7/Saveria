import type { Me } from '../../src/session/session-store';

/** `Me` mínimo válido; cada prueba cambia solo lo que le interesa. */
export function makeMe(
  overrides: {
    onboardingStep?: Me['profile']['onboardingStep'];
    verificationRequired?: boolean;
    emailVerified?: boolean;
  } = {},
): Me {
  return {
    id: '0199a1b2-0000-7000-8000-000000000001',
    email: 'ana@mail.com',
    emailVerified: overrides.emailVerified ?? false,
    verificationDeadline: '2026-10-29T12:00:00.000Z',
    verificationRequired: overrides.verificationRequired ?? false,
    profile: {
      aiName: null,
      countryCode: null,
      city: null,
      primaryCurrency: null,
      referenceCurrencies: [],
      aiMode: 'manual',
      onboardingStep: overrides.onboardingStep ?? 'done',
      updatedAt: '2026-10-22T12:00:00.000Z',
    },
    defaultAccount: null,
  };
}
