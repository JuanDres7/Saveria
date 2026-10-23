import { ONBOARDING_STEPS } from '@saveria/shared';
import { getOpenUserDb } from '../../db/open-user-db';
import type { Outbox } from '../../outbox/outbox';
import { onOutboxConflict, outboxFor } from '../../outbox/user-outbox';
import { useSession } from '../../session/session-store';
import { DrizzleLocalStore, type LocalStore, type ProfileFields } from './local-store';

/** Lo que necesitan los servicios que escriben datos del usuario: su base local y su outbox. */
export interface UserContext {
  userId: string;
  local: LocalStore;
  outbox: Pick<Outbox, 'enqueue' | 'flush'>;
}

export interface ProfileServiceDeps {
  /** `null` si no hay sesión con la base abierta. */
  context(): UserContext | null;
  now(): number;
}

export type ProfileChanges = Partial<Omit<ProfileFields, 'updatedAt'>>;

const stepIndex = (step: ProfileFields['onboardingStep']) => ONBOARDING_STEPS.indexOf(step);

/** Contexto real: la base del usuario que está abierta y su outbox. */
export function openUserContext(): UserContext | null {
  const open = getOpenUserDb();
  if (!open) return null;
  return { userId: open.userId, local: new DrizzleLocalStore(open.db), outbox: outboxFor(open.db) };
}

/** Actualiza el perfil en la sesión (lo que ven las pantallas y las guardas). */
export function showProfile(profile: ProfileFields): void {
  const { me, setMe } = useSession.getState();
  if (me) setMe({ ...me, profile });
}

/** Envía lo pendiente si hay red; sin red queda en el outbox hasta que vuelva. */
export function flushIfOnline(context: UserContext): void {
  if (useSession.getState().isOnline) void context.outbox.flush().catch(() => undefined);
}

export function createProfileService({ context, now }: ProfileServiceDeps) {
  function requireContext(): UserContext {
    const ctx = context();
    if (!ctx) throw new Error('No hay una sesión con la base local abierta');
    return ctx;
  }

  function currentProfile(ctx: UserContext): ProfileFields {
    const local = ctx.local.readProfile(ctx.userId);
    const shown = useSession.getState().me?.profile;
    const profile = local ?? shown;
    if (!profile) throw new Error('No hay perfil del usuario');
    return profile;
  }

  return {
    /**
     * Guarda un cambio del perfil: primero en la base local (funciona sin conexión), luego lo
     * encola como registro completo para `PUT /v1/me/profile` (last-write-wins, FR-022).
     */
    async save(
      changes: ProfileChanges,
      options: { autoModeConfirmed?: boolean } = {},
    ): Promise<ProfileFields> {
      const ctx = requireContext();
      const previous = currentProfile(ctx);
      const next: ProfileFields = { ...previous, ...changes };

      // El paso del onboarding solo avanza (igual que en el servidor).
      if (stepIndex(next.onboardingStep) < stepIndex(previous.onboardingStep)) {
        next.onboardingStep = previous.onboardingStep;
      }
      // La moneda principal no puede ser también de referencia.
      next.referenceCurrencies = next.referenceCurrencies.filter(
        (code) => code !== next.primaryCurrency,
      );
      // Siempre más nuevo que lo guardado: el perfil local puede tener la hora del servidor y, si
      // el reloj del teléfono va atrasado, `now()` haría que el servidor rechazara cada cambio.
      next.updatedAt = new Date(Math.max(now(), Date.parse(previous.updatedAt) + 1)).toISOString();

      ctx.local.writeProfile(ctx.userId, next);
      ctx.outbox.enqueue({
        entity: 'profile',
        entityId: ctx.userId,
        operation: 'upsert',
        payload: {
          method: 'PUT',
          path: '/v1/me/profile',
          body: { ...next, ...(options.autoModeConfirmed ? { autoModeConfirmed: true } : {}) },
        },
      });
      showProfile(next);
      flushIfOnline(ctx);
      return next;
    },

    /**
     * Ante un 409, el servidor tiene una versión más nueva y la app la adopta. Pero solo si de
     * verdad es más nueva que la local: si no, hay un cambio local posterior todavía en la cola.
     */
    adoptServerProfile(server: unknown): void {
      const ctx = context();
      const profile = server as ProfileFields | null;
      if (!ctx || typeof profile?.updatedAt !== 'string') return;
      const local = ctx.local.readProfile(ctx.userId);
      if (local && Date.parse(profile.updatedAt) < Date.parse(local.updatedAt)) return;
      ctx.local.writeProfile(ctx.userId, profile);
      showProfile(profile);
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;

export const profileService = createProfileService({
  context: openUserContext,
  now: () => Date.now(),
});

/**
 * Ante un 409 del perfil, adopta la versión del servidor. Se registra al arrancar la app (en
 * `_layout`), no al importar este archivo: así funciona aunque ninguna pantalla abierta lo use.
 */
export function registerProfileConflictHandler(): void {
  onOutboxConflict('profile', (body) => profileService.adoptServerProfile(body));
}
