import { COUNTRIES, CURRENCIES } from '@saveria/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { authService } from '../../../features/auth/auth-service';
import {
  Banner,
  Body,
  Field,
  PrimaryButton,
  RadioOption,
  TextButton,
} from '../../../features/auth/components';
import { profileService } from '../../../features/profile/profile-service';
import { SettingsGroup } from '../../../features/settings/SettingsGroup';
import { FormLabel } from '../../../features/transactions/form-parts';
import { useSession } from '../../../session/session-store';
import { Globe, Sparkles, UserRound } from '../../../ui/icons';
import { Page } from '../../../ui/Page';

const MAX_REFERENCES = 2;
type Mode = 'manual' | 'auto';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <FormLabel label={title} />
      {children}
    </View>
  );
}

/**
 * Configuración (FR-018 a FR-022). Los cambios se guardan primero en el teléfono y se envían al
 * servidor cuando hay conexión, así que funciona sin internet (escenario 3.4).
 */
export default function Settings() {
  const profile = useSession((s) => s.me?.profile);
  const isOnline = useSession((s) => s.isOnline);

  const [aiName, setAiName] = useState(profile?.aiName ?? '');
  const [countryCode, setCountryCode] = useState(profile?.countryCode ?? null);
  const [city, setCity] = useState(profile?.city ?? '');
  const [primaryCurrency, setPrimaryCurrency] = useState(profile?.primaryCurrency ?? null);
  const [references, setReferences] = useState<string[]>(profile?.referenceCurrencies ?? []);
  const [aiMode, setAiMode] = useState<Mode>(profile?.aiMode ?? 'manual');
  const [autoConfirmed, setAutoConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [referenceLimit, setReferenceLimit] = useState(false);

  if (!profile) return null;

  // FR-019: pasar de manual a automático pide confirmar qué implica.
  const turningAuto = profile.aiMode === 'manual' && aiMode === 'auto';
  const tooLong = aiName.trim().length > 30 || city.trim().length > 80;

  function choosePrimary(code: string) {
    setPrimaryCurrency(code);
    setReferences((current) => current.filter((c) => c !== code));
  }

  function toggleReference(code: string) {
    setNotice(null);
    if (references.includes(code)) {
      setReferences(references.filter((c) => c !== code));
      setReferenceLimit(false);
    } else if (references.length >= MAX_REFERENCES) {
      setReferenceLimit(true);
    } else {
      setReferences([...references, code]);
    }
  }

  async function save() {
    try {
      await profileService.save(
        {
          aiName: aiName.trim() === '' ? null : aiName.trim(),
          countryCode,
          city: city.trim() === '' ? null : city.trim(),
          primaryCurrency,
          referenceCurrencies: references,
          aiMode,
        },
        { autoModeConfirmed: turningAuto && autoConfirmed },
      );
      setAutoConfirmed(false);
      setNotice(
        isOnline
          ? 'Cambios guardados.'
          : 'Guardado en este teléfono. Se enviará cuando haya conexión.',
      );
    } catch {
      setNotice('No pudimos guardar los cambios. Inténtalo de nuevo.');
    }
  }

  return (
    <Page title="Configuración">
      <SettingsGroup id="saveria" title="Saveria" icon={Sparkles}>
        <Field
          label="Nombre para la IA"
          autoCapitalize="words"
          value={aiName}
          onChangeText={setAiName}
          error={aiName.trim().length > 30 ? 'Máximo 30 caracteres' : undefined}
        />

        <Section title="Modo de la IA">
          <RadioOption
            label="Manual"
            description="La IA te propone los movimientos y te pregunta antes de guardar."
            checked={aiMode === 'manual'}
            onPress={() => setAiMode('manual')}
          />
          <RadioOption
            label="Automático"
            description="La IA guarda sin preguntar lo que entiende de tus relatos."
            checked={aiMode === 'auto'}
            onPress={() => setAiMode('auto')}
          />
          {turningAuto ? (
            <>
              <Banner message="Con el modo automático, las acciones de la IA se guardan sin preguntarte. Siempre se pueden deshacer desde el historial." />
              <RadioOption
                role="checkbox"
                label="Entiendo y quiero activar el modo automático"
                checked={autoConfirmed}
                onPress={() => setAutoConfirmed(!autoConfirmed)}
              />
            </>
          ) : null}
        </Section>
      </SettingsGroup>

      <SettingsGroup id="region" title="País y moneda" icon={Globe}>
        <Section title="País">
          {COUNTRIES.map((country) => (
            <RadioOption
              key={country.code}
              label={country.name}
              checked={countryCode === country.code}
              onPress={() => setCountryCode(country.code)}
            />
          ))}
        </Section>

        <Field
          label="Ciudad"
          autoCapitalize="words"
          value={city}
          onChangeText={setCity}
          error={city.trim().length > 80 ? 'Máximo 80 caracteres' : undefined}
        />

        <Section title="Moneda principal">
          <Body muted>Cambiarla no modifica tus cuentas ni tus movimientos.</Body>
          {CURRENCIES.map((currency) => (
            <RadioOption
              key={currency.code}
              label={`${currency.code} · ${currency.name}`}
              checked={primaryCurrency === currency.code}
              onPress={() => choosePrimary(currency.code)}
            />
          ))}
        </Section>

        <Section title="Monedas de referencia">
          <Body muted>Hasta 2. Verás tus totales también en estas monedas.</Body>
          {referenceLimit ? <Banner message="Puedes elegir hasta 2 monedas de referencia" /> : null}
          {CURRENCIES.filter((currency) => currency.code !== primaryCurrency).map((currency) => (
            <RadioOption
              key={currency.code}
              role="checkbox"
              label={`${currency.code} · ${currency.name}`}
              checked={references.includes(currency.code)}
              // El aviso de arriba puede quedar fuera de la vista: cada opción lo repite.
              description={
                references.length >= MAX_REFERENCES && !references.includes(currency.code)
                  ? 'Ya elegiste 2. Quita una para elegir esta.'
                  : undefined
              }
              onPress={() => toggleReference(currency.code)}
            />
          ))}
        </Section>
      </SettingsGroup>

      {notice ? <Body>{notice}</Body> : null}
      <PrimaryButton
        label="Guardar cambios"
        disabled={tooLong || (turningAuto && !autoConfirmed)}
        onPress={() => void save()}
      />

      <SettingsGroup id="account" title="Tu cuenta" icon={UserRound}>
        <TextButton
          label="Cambiar contraseña"
          onPress={() => router.push('/settings/change-password')}
        />
        <TextButton
          label="Borrar mi cuenta"
          onPress={() => router.push('/settings/delete-account')}
        />
        <TextButton label="Cerrar sesión" onPress={() => void authService.logout()} />
      </SettingsGroup>
    </Page>
  );
}
