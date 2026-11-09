import { passwordSchema } from '@saveria/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { AuthError, authService } from '../../../features/auth/auth-service';
import {
  Banner,
  Field,
  PrimaryButton,
  Screen,
  styles,
  TextButton,
} from '../../../features/auth/components';
import { useSession } from '../../../session/session-store';

function messageFor(error: unknown): string {
  if (!(error instanceof AuthError)) return 'No pudimos cambiar tu contraseña. Inténtalo de nuevo.';
  switch (error.code) {
    case 'invalid_credentials':
      return 'La contraseña actual no es correcta';
    case 'too_many_attempts':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'validation_error':
      return error.fields?.newPassword ?? error.message;
    default:
      return error.message;
  }
}

/** Cambiar la contraseña conociendo la actual (FR-018a). Requiere conexión. */
export default function ChangePassword() {
  const isOnline = useSession((s) => s.isOnline);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newError, setNewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit() {
    setError(null);
    setDone(false);
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      setNewError(parsed.error.issues[0]?.message ?? 'Contraseña inválida');
      return;
    }
    setNewError(null);
    setSending(true);
    try {
      await authService.changePassword({ currentPassword, newPassword: parsed.data });
      setCurrentPassword('');
      setNewPassword('');
      setDone(true);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen title="Cambiar contraseña">
      {!isOnline ? <Banner message="Para cambiar tu contraseña necesitas internet." /> : null}
      <Field
        label="Contraseña actual"
        secureTextEntry
        autoComplete="current-password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />
      <Field
        label="Contraseña nueva"
        secureTextEntry
        autoComplete="new-password"
        value={newPassword}
        onChangeText={setNewPassword}
        error={newError ?? undefined}
      />
      <Text>Mínimo 8 caracteres, con al menos una letra y un número.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {done ? (
        <Text>Listo. Cambiamos tu contraseña y cerramos la sesión en tus otros dispositivos.</Text>
      ) : null}
      <PrimaryButton
        label="Cambiar contraseña"
        disabled={!isOnline || sending || currentPassword === ''}
        onPress={() => void submit()}
      />
      <TextButton label="Volver" onPress={() => router.back()} />
    </Screen>
  );
}
