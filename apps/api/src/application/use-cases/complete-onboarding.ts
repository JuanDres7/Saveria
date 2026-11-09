import { DomainError } from '../../domain/errors';
import type { MeDto } from '../dto';
import type { UnitOfWork } from '../ports/repositories';
import type { Clock } from '../ports/services';
import { createDefaultAccount } from './create-default-account';
import { toMe } from './get-me';

export interface CompleteOnboardingDeps {
  uow: UnitOfWork;
  clock: Clock;
}

/**
 * Termina el onboarding: crea "Efectivo" si el usuario todavía no tiene cuenta por defecto y pone
 * `onboarding_step = done`, todo en una transacción. Es idempotente: la app la encola en el outbox
 * y puede llegar más de una vez.
 *
 * No toca `updated_at` del perfil: ese reloj es del cliente (last-write-wins) y moverlo con la
 * hora del servidor haría perder cambios del teléfono que llegan después.
 */
export function createCompleteOnboarding({ uow, clock }: CompleteOnboardingDeps) {
  return async function completeOnboarding(
    userId: string,
    defaultAccountId: string,
  ): Promise<MeDto> {
    const now = clock.now();
    return uow.run(async (repos) => {
      const [user, profile] = await Promise.all([
        repos.users.findById(userId),
        repos.profiles.findById(userId),
      ]);
      if (!user || !profile) throw new DomainError('unauthorized');
      if (profile.primaryCurrency === null) throw new DomainError('primary_currency_required');

      let account = await repos.accounts.findDefaultByUser(userId);
      if (!account) {
        const taken = await repos.accounts.findById(defaultAccountId);
        // Un id que ya es de otra cuenta (de otro usuario o borrada) no se reutiliza ni se toca.
        if (taken) {
          throw new DomainError('validation_error', {
            fields: { defaultAccountId: 'Identificador de cuenta no válido' },
          });
        }
        account = await createDefaultAccount(repos.accounts, {
          id: defaultAccountId,
          userId,
          currency: profile.primaryCurrency,
          now,
        });
      }

      if (profile.onboardingStep !== 'done') {
        profile.onboardingStep = 'done';
        await repos.profiles.save(profile);
      }
      return toMe(user, profile, account, now);
    });
  };
}
