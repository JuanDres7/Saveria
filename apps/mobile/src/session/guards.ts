import type { Me, SessionStatus } from './session-store';

/**
 * Zona de la app que le corresponde al usuario:
 * - `splash`: todavía no se sabe si hay sesión.
 * - `auth`: sin sesión (bienvenida, registro, login).
 * - `onboarding`: con sesión pero sin terminar el onboarding.
 * - `verify-gate`: pasaron 7 días sin verificar el correo. Solo se muestra con conexión, cuando
 *   el servidor lo confirmó; sin conexión la app funciona normal (FR-032).
 * - `app`: la app.
 */
export type RouteGroup = 'splash' | 'auth' | 'onboarding' | 'verify-gate' | 'app';

export interface GuardState {
  status: SessionStatus;
  me: Me | null;
  isOnline: boolean;
}

export function routeGroupFor({ status, me, isOnline }: GuardState): RouteGroup {
  if (status === 'unknown') return 'splash';
  if (status === 'signedOut' || me === null) return 'auth';
  if (me.profile.onboardingStep !== 'done') return 'onboarding';
  if (me.verificationRequired && isOnline) return 'verify-gate';
  return 'app';
}

/**
 * Pantalla de entrada de cada zona. La ruta `/` usa esta tabla para mandar al usuario al lugar
 * correcto; los nombres de grupo, como `(auth)`, no forman parte de la URL.
 */
export const ENTRY_ROUTE = {
  auth: '/welcome',
  onboarding: '/ai-name',
  'verify-gate': '/verify-email-gate',
  app: '/home',
} as const;

/** Pantalla de cada paso del onboarding, en el orden en que se piden (FR-011). */
export const ONBOARDING_ROUTE = {
  ai_name: '/ai-name',
  country: '/country',
  city: '/city',
  currency: '/currency',
  ai_mode: '/ai-mode',
} as const;

type PendingStep = keyof typeof ONBOARDING_ROUTE;

/**
 * Pantalla de entrada de la zona. En el onboarding es la del paso pendiente, para retomarlo donde
 * quedó (FR-014, escenario 2.5).
 */
export function entryRouteFor(group: Exclude<RouteGroup, 'splash'>, me: Me | null) {
  const step = me?.profile.onboardingStep;
  if (group === 'onboarding' && step && step !== 'done') {
    return ONBOARDING_ROUTE[step as PendingStep];
  }
  return ENTRY_ROUTE[group];
}
