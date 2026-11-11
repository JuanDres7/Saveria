import { router } from 'expo-router';
import { useState } from 'react';
import {
  Body,
  Field,
  FieldError,
  PrimaryButton,
  Screen,
  TextButton,
} from '../../features/auth/components';
import { StepProgress } from '../../features/onboarding/StepProgress';
import { profileService } from '../../features/profile/profile-service';
import { useSession } from '../../session/session-store';

const MAX = 30;

/** Paso 1 de 5: cómo quiere el usuario que la IA lo llame (opcional, FR-017). */
export default function AiName() {
  const saved = useSession((s) => s.me?.profile.aiName);
  const [value, setValue] = useState(saved ?? '');
  const [error, setError] = useState<string | null>(null);

  async function next(aiName: string | null) {
    try {
      await profileService.save({ aiName, onboardingStep: 'country' });
      router.replace('/country');
    } catch {
      setError('No pudimos guardar tu respuesta. Inténtalo de nuevo.');
    }
  }

  const trimmed = value.trim();
  const tooLong = trimmed.length > MAX;

  return (
    <Screen title="¿Cómo quieres que la IA te llame?">
      <StepProgress step={1} />
      <Body muted>Es opcional: si lo dejas vacío usaremos tu correo.</Body>
      <Field
        label="Nombre para la IA"
        autoCapitalize="words"
        value={value}
        onChangeText={setValue}
        error={tooLong ? `Máximo ${MAX} caracteres` : undefined}
      />
      {error ? <FieldError message={error} /> : null}
      <PrimaryButton
        label="Continuar"
        disabled={tooLong}
        onPress={() => void next(trimmed === '' ? null : trimmed)}
      />
      <TextButton label="Saltar" onPress={() => void next(null)} />
    </Screen>
  );
}
