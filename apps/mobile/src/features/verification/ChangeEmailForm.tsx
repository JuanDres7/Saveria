import { emailSchema } from '@saveria/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthError } from '../auth/auth-service';
import { Body, Field, TextButton } from '../auth/components';
import { verificationService } from './verification-service';

function messageFor(error: unknown): string {
  if (!(error instanceof AuthError)) return 'Ocurrió un error. Inténtalo de nuevo.';
  switch (error.code) {
    case 'email_unavailable':
      return 'No pudimos usar ese correo. Prueba con otro.';
    case 'email_already_verified':
      return 'Tu correo ya está verificado.';
    case 'validation_error':
      return error.fields?.email ?? error.message;
    default:
      return error.message;
  }
}

/**
 * Corregir el correo mientras no esté verificado (FR-034): el correo nuevo recibe un enlace nuevo
 * y los anteriores dejan de servir. Requiere conexión.
 */
export function ChangeEmailForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    setMessage(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Correo inválido');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const me = await verificationService.changeEmail(parsed.data);
      setEmail('');
      setMessage(`Listo. Te enviamos un enlace a ${me.email}.`);
    } catch (e) {
      setMessage(messageFor(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ gap: 4 }}>
      <Field
        label="Correo correcto"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        error={error ?? undefined}
      />
      {message ? <Body>{message}</Body> : null}
      {sending ? null : <TextButton label="Cambiar correo" onPress={() => void submit()} />}
    </View>
  );
}
