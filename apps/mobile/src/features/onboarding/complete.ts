import * as Crypto from 'expo-crypto';
import { useSession } from '../../session/session-store';
import type { LocalAccount } from '../profile/local-store';
import { flushIfOnline, openUserContext, type UserContext } from '../profile/profile-service';

export interface OnboardingCompleterDeps {
  context(): UserContext | null;
  now(): number;
  newId(): string;
}

/**
 * Termina el onboarding sin depender de la red (SC-004): crea "Efectivo" en la base local con un
 * UUID propio, marca el onboarding como terminado y encola `POST /v1/me/onboarding/complete`, que
 * es idempotente por ese mismo id. El usuario puede registrar movimientos de inmediato.
 */
export function createOnboardingCompleter({ context, now, newId }: OnboardingCompleterDeps) {
  return {
    run(): void {
      const ctx = context();
      if (!ctx) throw new Error('No hay una sesión con la base local abierta');
      const profile = ctx.local.readProfile(ctx.userId);
      if (!profile?.primaryCurrency) throw new Error('Falta la moneda principal (FR-015)');

      let account: LocalAccount | null = ctx.local.readDefaultAccount();
      if (!account) {
        account = {
          id: newId(),
          name: 'Efectivo',
          currency: profile.primaryCurrency,
          initialBalance: '0',
          isDefault: true,
        };
        ctx.local.writeAccount(account);
      }
      ctx.outbox.enqueue({
        entity: 'onboarding',
        entityId: ctx.userId,
        operation: 'complete',
        payload: {
          method: 'POST',
          path: '/v1/me/onboarding/complete',
          body: { defaultAccountId: account.id },
        },
      });

      // El servidor marca `done` al recibir la llamada; aquí se marca ya, con un `updatedAt` más
      // nuevo para que un `me` viejo del servidor no lo deshaga al volver a entrar.
      const done = {
        ...profile,
        onboardingStep: 'done' as const,
        updatedAt: new Date(Math.max(now(), Date.parse(profile.updatedAt) + 1)).toISOString(),
      };
      ctx.local.writeProfile(ctx.userId, done);
      const { me, setMe } = useSession.getState();
      if (me) setMe({ ...me, profile: done, defaultAccount: account });

      flushIfOnline(ctx);
    },
  };
}

export const completeOnboarding = createOnboardingCompleter({
  context: openUserContext,
  now: () => Date.now(),
  newId: () => Crypto.randomUUID(),
});
