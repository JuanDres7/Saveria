import { CURRENCIES, suggestedCurrencyFor } from '@saveria/shared';
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

/** Paso 4 de 5: moneda principal, preseleccionada según el país (FR-012). */
export default function Currency() {
  const profile = useSession((s) => s.me?.profile);
  const [selected, setSelected] = useState<string | null>(
    profile?.primaryCurrency ?? suggestedCurrencyFor(profile?.countryCode ?? ''),
  );
  const [error, setError] = useState<string | null>(null);

  async function next() {
    if (!selected) return;
    try {
      await profileService.save({ primaryCurrency: selected, onboardingStep: 'ai_mode' });
      router.replace('/ai-mode');
    } catch {
      setError('No pudimos guardar tu respuesta. Inténtalo de nuevo.');
    }
  }

  return (
    <Screen title="¿Cuál será tu moneda principal?">
      <StepProgress step={4} />
      <Body muted>En ella verás tus totales. Puedes cambiarla después.</Body>
      <ScrollView style={{ flexGrow: 0, maxHeight: '60%' }} contentContainerStyle={{ gap: 8 }}>
        {CURRENCIES.map((currency) => (
          <RadioOption
            key={currency.code}
            label={`${currency.code} · ${currency.name}`}
            checked={selected === currency.code}
            onPress={() => setSelected(currency.code)}
          />
        ))}
      </ScrollView>
      {error ? <FieldError message={error} /> : null}
      <PrimaryButton label="Continuar" disabled={!selected} onPress={() => void next()} />
    </Screen>
  );
}
