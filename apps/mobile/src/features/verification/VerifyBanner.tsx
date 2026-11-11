import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '../../session/session-store';
import { type Theme, useStyles } from '../../theme';
import { AuthError } from '../auth/auth-service';
import { TextButton } from '../auth/components';
import { ChangeEmailForm } from './ChangeEmailForm';
import { verificationService } from './verification-service';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    banner: {
      backgroundColor: t.colors.warningBackground,
      borderRadius: t.radius.control,
      padding: 12,
    },
    title: { ...t.type.bodyStrong, fontSize: 16, color: t.colors.warningText },
    text: { ...t.type.body, color: t.colors.warningText },
  });

/** Fecha corta en español, por ejemplo "31 de octubre". */
export function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

/**
 * Recordatorio mientras el correo no esté verificado (FR-031): la app se puede usar con
 * normalidad hasta que venza el plazo de 7 días. Desde aquí se puede reenviar el correo o
 * corregir la dirección (FR-034).
 */
export function VerifyBanner() {
  const styles = useStyles(makeStyles);
  const me = useSession((s) => s.me);
  const isOnline = useSession((s) => s.isOnline);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [correcting, setCorrecting] = useState(false);

  if (!me || me.emailVerified) return null;

  async function resend() {
    setSending(true);
    try {
      setMessage(await verificationService.resend());
    } catch (e) {
      setMessage(e instanceof AuthError ? e.message : 'No pudimos reenviar el correo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View role="alert" style={styles.banner}>
      <Text style={styles.title}>Confirma tu correo</Text>
      <Text style={styles.text}>
        {`Te enviamos un enlace a ${me.email}. Tienes hasta el ${formatDeadline(me.verificationDeadline)} para confirmarlo.`}
      </Text>
      {message ? <Text style={styles.text}>{message}</Text> : null}
      {isOnline && !sending ? (
        <TextButton label="Reenviar correo" onPress={() => void resend()} />
      ) : null}
      {isOnline && !correcting ? (
        <TextButton label="Corregir mi correo" onPress={() => setCorrecting(true)} />
      ) : null}
      {isOnline && correcting ? <ChangeEmailForm /> : null}
    </View>
  );
}
