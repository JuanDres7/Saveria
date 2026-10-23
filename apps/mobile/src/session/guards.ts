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
