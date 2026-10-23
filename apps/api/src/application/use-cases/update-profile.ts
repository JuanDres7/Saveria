import { ONBOARDING_STEPS, type ProfileInput, profileInputSchema } from '@saveria/shared';
import type { Profile } from '../../domain/entities';
import { DomainError } from '../../domain/errors';
import type { ProfileDto } from '../dto';
import type { ProfileRepository } from '../ports/repositories';
import { toProfileDto } from './get-me';

/** Lo que manda el cliente: el registro completo, su `updatedAt` local y la confirmación del modo. */
export interface ProfileUpdateInput {
  aiName: string | null;
  countryCode: string | null;
  city: string | null;
  primaryCurrency: string | null;
  referenceCurrencies: string[];
  aiMode: string;
  onboardingStep: string;
  updatedAt: string;
  autoModeConfirmed?: boolean;
}

export type UpdateProfileResult =
  | { status: 'saved'; profile: ProfileDto }
  /** El servidor tiene una versión igual o más nueva: el cliente la adopta (409). */
  | { status: 'conflict'; profile: ProfileDto };

export interface UpdateProfileDeps {
  repositories: { profiles: ProfileRepository };
}

const stepIndex = (step: string) => ONBOARDING_STEPS.indexOf(step as Profile['onboardingStep']);

function validate(input: ProfileUpdateInput): ProfileInput {
  // Si la moneda principal estaba entre las de referencia, se quita de ahí (data-model). Se hace
  // antes de validar porque la regla compartida rechaza justamente esa combinación.
  const parsed = profileInputSchema.safeParse({
    ...input,
    referenceCurrencies: input.referenceCurrencies.filter((c) => c !== input.primaryCurrency),
  });
  if (parsed.success) return parsed.data;

  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'body');
    fields[key] ??= issue.message;
  }
  throw new DomainError('validation_error', { fields });
}

/**
 * Guarda el perfil con *last-write-wins* por registro completo (research §6): se aplica solo si
 * el `updatedAt` del cliente es más nuevo que el del servidor.
 */
export function createUpdateProfile({ repositories }: UpdateProfileDeps) {
  return async function updateProfile(
    userId: string,
    input: ProfileUpdateInput,
  ): Promise<UpdateProfileResult> {
    const values = validate(input);
    const current = await repositories.profiles.findById(userId);
    if (!current) throw new DomainError('unauthorized');

    const updatedAt = new Date(input.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) {
      throw new DomainError('validation_error', { fields: { updatedAt: 'Fecha inválida' } });
    }
    if (updatedAt.getTime() <= current.updatedAt.getTime()) {
      return { status: 'conflict', profile: toProfileDto(current) };
    }

    // El paso del onboarding solo avanza: un cambio viejo no lo hace retroceder.
    const onboardingStep =
      stepIndex(values.onboardingStep) > stepIndex(current.onboardingStep)
        ? values.onboardingStep
        : current.onboardingStep;

    if (onboardingStep === 'done' && values.primaryCurrency === null) {
      throw new DomainError('validation_error', {
        fields: { primaryCurrency: 'Elige tu moneda principal para terminar' },
      });
    }
    // FR-019: la app pide confirmación antes de activar el modo automático.
    if (current.aiMode === 'manual' && values.aiMode === 'auto' && !input.autoModeConfirmed) {
      throw new DomainError('validation_error', {
        fields: { aiMode: 'Confirma que quieres activar el modo automático' },
      });
    }

    const profile: Profile = {
      ...current,
      aiName: values.aiName,
      countryCode: values.countryCode,
      city: values.city,
      primaryCurrency: values.primaryCurrency,
      referenceCurrencies: values.referenceCurrencies,
      aiMode: values.aiMode,
      onboardingStep,
      updatedAt,
    };
    await repositories.profiles.save(profile);
    return { status: 'saved', profile: toProfileDto(profile) };
  };
}
