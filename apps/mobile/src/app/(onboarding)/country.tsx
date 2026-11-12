import { COUNTRIES } from '@saveria/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import {
  Body,
  FieldError,
  PrimaryButton,
  RadioOption,
  Screen,
} from '../../features/auth/components';
import { StepProgress } from '../../features/onboarding/StepProgress';
import { profileService } from '../../features/profile/profile-service';
import { useSession } from '../../session/session-store';

/** Paso 2 de 5: país (del catálogo; "Otro" no sugiere moneda). */
export default function Country() {
  const saved = useSession((s) => s.me?.profile.countryCode);
  const [selected, setSelected] = useState<string | null>(saved ?? null);
  const [error, setError] = useState<string | null>(null);

  async function next() {
    if (!selected) return;
    try {
      await profileService.save({ countryCode: selected, onboardingStep: 'city' });
      router.replace('/city');
    } catch {
      setError('No pudimos guardar tu respuesta. Inténtalo de nuevo.');
    }
  }

  return (
    <Screen title="¿En qué país estás?">
      <StepProgress step={2} />
      <Body muted>Lo usamos para sugerirte la moneda.</Body>
      <ScrollView style={{ flexGrow: 0, maxHeight: '60%' }} contentContainerStyle={{ gap: 8 }}>
        {COUNTRIES.map((country) => (
          <RadioOption
            key={country.code}
            label={country.name}
            checked={selected === country.code}
            onPress={() => setSelected(country.code)}
          />
        ))}
      </ScrollView>
      {error ? <FieldError message={error} /> : null}
      <PrimaryButton label="Continuar" disabled={!selected} onPress={() => void next()} />
    </Screen>
  );
}
