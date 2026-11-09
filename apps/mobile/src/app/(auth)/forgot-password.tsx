import { emailSchema } from '@saveria/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { AuthError, authService } from '../../features/auth/auth-service';
import {
  Banner,
  Field,
  PrimaryButton,
  Screen,
  styles,
  TextButton,
} from '../../features/auth/components';
import { useSession } from '../../session/session-store';

/**
 * Recuperar la contraseña (escenario 5.3). El mensaje es el mismo exista o no el correo (FR-030);
 * la contraseña nueva se crea en la página web del enlace (FR-037).
 */
export default function ForgotPassword() {
  const isOnline = useSession((s) => s.isOnline);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? 'Correo inválido');
      return;
    }
    setEmailError(null);
    setSending(true);
    try {
      setSent(await authService.forgotPassword(parsed.data));
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Ocurrió un error. Inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen title="Recupera tu contraseña">
      {!isOnline ? <Banner message="Para recuperar tu contraseña necesitas internet." /> : null}
      {sent ? (
        <>
          <Text>{sent}</Text>
          <Text>
            Abre el enlace del correo, crea tu contraseña nueva y vuelve a la app para entrar.
          </Text>
        </>
      ) : (
        <>
          <Text>Escribe el correo de tu cuenta y te enviaremos un enlace.</Text>
          <Field
            label="Correo"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            error={emailError ?? undefined}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label="Enviar enlace"
            disabled={!isOnline || sending}
            onPress={() => void submit()}
          />
        </>
      )}
      <TextButton label="Volver a entrar" onPress={() => router.back()} />
    </Screen>
  );
}
