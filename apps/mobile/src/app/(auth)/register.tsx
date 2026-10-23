import { zodResolver } from '@hookform/resolvers/zod';
import { emailSchema, PRIVACY_POLICY_PATH, passwordSchema } from '@saveria/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Linking, Pressable, Text, View } from 'react-native';
import { z } from 'zod';
import { API_URL } from '../../api/instance';
import { AuthError, authService } from '../../features/auth/auth-service';
import { Banner, Field, PrimaryButton, Screen, styles } from '../../features/auth/components';
import { useSession } from '../../session/session-store';

const schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  policyAccepted: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export default function Register() {
  const isOnline = useSession((s) => s.isOnline);
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, setError, watch, formState } = useForm<
    FormInput,
    unknown,
    FormOutput
  >({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', policyAccepted: false },
  });
  const policyAccepted = watch('policyAccepted');

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      // Si sale bien, la sesión pasa a `signedIn` y las guardas llevan al onboarding.
      await authService.register(values);
    } catch (error) {
      if (!(error instanceof AuthError)) {
        // Por ejemplo, un fallo al abrir la base local: el usuario no se queda sin respuesta.
        setServerError('No pudimos crear tu cuenta. Inténtalo de nuevo.');
        return;
      }
      for (const [field, message] of Object.entries(error.fields ?? {})) {
        if (field === 'email' || field === 'password') setError(field, { message });
      }
      setServerError(error.message);
    }
  });

  return (
    <Screen title="Crea tu cuenta">
      {!isOnline ? <Banner message="Para crear tu cuenta necesitas internet." /> : null}
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Field
            label="Correo"
            keyboardType="email-address"
            autoComplete="email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <Field
            label="Contraseña"
            secureTextEntry
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />
      <Text>Mínimo 8 caracteres, con al menos una letra y un número.</Text>

      <Controller
        control={control}
        name="policyAccepted"
        render={({ field }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              role="checkbox"
              aria-checked={field.value}
              accessibilityLabel="Acepto la política de tratamiento de datos"
              onPress={() => field.onChange(!field.value)}
              style={{
                width: 24,
                height: 24,
                borderWidth: 2,
                borderRadius: 4,
                borderColor: '#0f766e',
                backgroundColor: field.value ? '#0f766e' : 'transparent',
              }}
            />
            <Text style={{ flex: 1 }}>
              Acepto la{' '}
              <Text
                role="link"
                style={styles.link}
                onPress={() => void Linking.openURL(`${API_URL}${PRIVACY_POLICY_PATH}`)}
              >
                política de tratamiento de datos
              </Text>
            </Text>
          </View>
        )}
      />

      {serverError ? <Text style={styles.error}>{serverError}</Text> : null}
      <PrimaryButton
        label="Crear cuenta"
        onPress={onSubmit}
        disabled={!policyAccepted || !isOnline || formState.isSubmitting}
      />
      <Pressable role="link" onPress={() => router.push('/login')}>
        <Text style={styles.link}>Ya tengo cuenta</Text>
      </Pressable>
    </Screen>
  );
}
