import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Field, FieldError, PrimaryButton, Screen } from '../../features/auth/components';
import { StepProgress } from '../../features/onboarding/StepProgress';
import { profileService } from '../../features/profile/profile-service';
import { useSession } from '../../session/session-store';

const MAX = 80;

/** Paso 3 de 5: ciudad, en texto libre. */
export default function City() {
  const saved = useSession((s) => s.me?.profile.city);
  const [value, setValue] = useState(saved ?? '');
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const tooLong = trimmed.length > MAX;

  async function next() {
    try {
      await profileService.save({
        city: trimmed === '' ? null : trimmed,
        onboardingStep: 'currency',
      });
      router.replace('/currency');
    } catch {
      setError('No pudimos guardar tu respuesta. Inténtalo de nuevo.');
    }
  }

  return (
    <Screen title="¿En qué ciudad vives?">
      <StepProgress step={3} />
      <Body muted>Ayuda a la IA a entender tus gastos.</Body>
      <Field
        label="Ciudad"
        autoCapitalize="words"
        value={value}
        onChangeText={setValue}
        error={tooLong ? `Máximo ${MAX} caracteres` : undefined}
      />
      {error ? <FieldError message={error} /> : null}
      <PrimaryButton label="Continuar" disabled={tooLong} onPress={() => void next()} />
    </Screen>
  );
}
