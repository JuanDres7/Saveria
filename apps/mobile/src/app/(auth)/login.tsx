import { zodResolver } from '@hookform/resolvers/zod';
import { emailSchema } from '@saveria/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthError, authService } from '../../features/auth/auth-service';
import {
  Banner,
  Field,
  FieldError,
  LinkButton,
  PrimaryButton,
  Screen,
} from '../../features/auth/components';
import { useSession } from '../../session/session-store';

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Escribe tu contraseña'),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/**
 * Credenciales incorrectas y demasiados intentos muestran el mismo mensaje: no se revela si el
 * correo existe ni cuánto falta para desbloquear (FR-006, FR-007).
 */
const GENERIC_ERROR = 'No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo.';

function messageFor(error: AuthError): string {
  if (error.code === 'network_error') return error.message;
  return GENERIC_ERROR;
}

export default function Login() {
  const isOnline = useSession((s) => s.isOnline);
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await authService.login(values);
    } catch (error) {
      setServerError(error instanceof AuthError ? messageFor(error) : GENERIC_ERROR);
    }
  });

  return (
    <Screen title="Entra a tu cuenta" back>
      {!isOnline ? <Banner message="Para entrar necesitas internet." /> : null}
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
            autoComplete="current-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />
      {serverError ? <FieldError message={serverError} /> : null}
      <PrimaryButton
        label="Entrar"
        onPress={onSubmit}
        disabled={!isOnline || formState.isSubmitting}
      />
      <LinkButton label="Olvidé mi contraseña" onPress={() => router.push('/forgot-password')} />
      <LinkButton label="Crear una cuenta" onPress={() => router.push('/register')} />
    </Screen>
  );
}
