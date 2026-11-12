import { useState } from 'react';
import { AuthError, authService } from '../../../features/auth/auth-service';
import {
  Banner,
  Body,
  Field,
  FieldError,
  PrimaryButton,
  Screen,
} from '../../../features/auth/components';
import { useSession } from '../../../session/session-store';

function messageFor(error: unknown): string {
  if (!(error instanceof AuthError)) return 'No pudimos borrar tu cuenta. Inténtalo de nuevo.';
  switch (error.code) {
    case 'invalid_credentials':
      return 'La contraseña no es correcta';
    case 'too_many_attempts':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    default:
      return error.message;
  }
}

function pendingWarning(count: number): string {
  return count === 1
    ? 'Tienes 1 cambio sin sincronizar: se descartará junto con tu cuenta.'
    : `Tienes ${count} cambios sin sincronizar: se descartarán junto con tu cuenta.`;
}

/**
 * Borrar la cuenta y todos sus datos (FR-023, FR-024), confirmando con la contraseña. Requiere
 * conexión. Al terminar, la sesión se cierra y las guardas llevan a la bienvenida.
 */
export default function DeleteAccount() {
  const isOnline = useSession((s) => s.isOnline);
  const [pending] = useState(() => authService.pendingChanges());
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    setError(null);
    setSending(true);
    try {
      await authService.deleteAccount(password);
    } catch (e) {
      setError(messageFor(e));
      setSending(false);
    }
  }

  return (
    <Screen title="Borrar mi cuenta" back>
      {!isOnline ? <Banner message="Para borrar tu cuenta necesitas internet." /> : null}
      <Body>
        Se borrarán tu cuenta y todos tus datos: movimientos, cuentas, relatos y preferencias, en
        este dispositivo y en el servidor.
      </Body>
      <FieldError message="Esta acción no se puede deshacer." />
      {pending > 0 ? <Body>{pendingWarning(pending)}</Body> : null}
      <Field
        label="Contraseña"
        secureTextEntry
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
      />
      {error ? <FieldError message={error} /> : null}
      <PrimaryButton
        label="Borrar mi cuenta"
        disabled={!isOnline || sending || password === ''}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
