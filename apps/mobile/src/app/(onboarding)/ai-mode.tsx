import { useState } from 'react';
import {
  Banner,
  Body,
  FieldError,
  PrimaryButton,
  RadioOption,
  Screen,
} from '../../features/auth/components';
import { completeOnboarding } from '../../features/onboarding/complete';
import { StepProgress } from '../../features/onboarding/StepProgress';
import { profileService } from '../../features/profile/profile-service';
import { useSession } from '../../session/session-store';

type Mode = 'manual' | 'auto';

/**
 * Paso 5 de 5: modo de la IA. Manual viene seleccionado (FR-013); elegir automático muestra qué
 * implica y el botón lo confirma (FR-019). Al terminar, las guardas llevan a la pantalla principal.
 */
export default function AiMode() {
  const saved = useSession((s) => s.me?.profile.aiMode);
  const [mode, setMode] = useState<Mode>(saved ?? 'manual');
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    try {
      await profileService.save({ aiMode: mode }, { autoModeConfirmed: mode === 'auto' });
      completeOnboarding.run();
    } catch {
      setError('No pudimos terminar. Inténtalo de nuevo.');
    }
  }

  return (
    <Screen title="¿Cómo quieres que trabaje la IA?">
      <StepProgress step={5} />
      <Body muted>Puedes cambiarlo cuando quieras en Configuración.</Body>
      <RadioOption
        label="Manual"
        description="La IA te propone los movimientos y te pregunta antes de guardar."
        checked={mode === 'manual'}
        onPress={() => setMode('manual')}
      />
      <RadioOption
        label="Automático"
        description="La IA guarda sin preguntar lo que entiende de tus relatos."
        checked={mode === 'auto'}
        onPress={() => setMode('auto')}
      />
      {mode === 'auto' ? (
        <Banner message="Con el modo automático, las acciones de la IA se guardan sin preguntarte. Siempre se pueden deshacer desde el historial." />
      ) : null}
      {error ? <FieldError message={error} /> : null}
      <PrimaryButton
        label={mode === 'auto' ? 'Activar el modo automático y terminar' : 'Terminar'}
        onPress={() => void finish()}
      />
    </Screen>
  );
}
