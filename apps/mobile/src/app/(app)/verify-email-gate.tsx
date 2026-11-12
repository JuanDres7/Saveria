import { useState } from 'react';
import { AuthError, authService } from '../../features/auth/auth-service';
import { Body, PrimaryButton, Screen, TextButton } from '../../features/auth/components';
import { FormLabel } from '../../features/transactions/form-parts';
import { ChangeEmailForm } from '../../features/verification/ChangeEmailForm';
import { verificationService } from '../../features/verification/verification-service';
import { useSession } from '../../session/session-store';

/**
 * Bloqueo a los 7 días sin verificar (FR-032, escenario 6.4). Solo aparece con conexión y cuando
 * el servidor lo confirmó; los datos se conservan y el outbox sigue enviando en segundo plano.
 */
export default function VerifyEmailGate() {
  const email = useSession((s) => s.me?.email ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (e) {
      setMessage(e instanceof AuthError ? e.message : 'Ocurrió un error. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  const resend = () => run(() => verificationService.resend());

  // Si el servidor ya lo ve verificado, las guardas llevan a la app solas.
  const checkVerified = () =>
    run(async () => {
      const me = await verificationService.refresh();
      return me.emailVerified
        ? null
        : 'Todavía no vemos tu correo confirmado. Abre el enlace del correo y vuelve a intentarlo.';
    });

  return (
    <Screen title="Confirma tu correo para continuar">
      <Body>
        {`Pasaron 7 días y tu correo ${email} sigue sin confirmar. Abre el enlace que te enviamos para seguir usando Saveria. Tus datos están a salvo.`}
      </Body>
      {message ? <Body>{message}</Body> : null}
      <PrimaryButton
        label="Ya confirmé mi correo"
        disabled={busy}
        onPress={() => void checkVerified()}
      />
      <TextButton label="Reenviar correo" onPress={() => void resend()} />

      <FormLabel label="¿Escribiste mal tu correo?" />
      <ChangeEmailForm />
      <TextButton label="Cerrar sesión" onPress={() => void authService.logout()} />
    </Screen>
  );
}
