import { formatAmount } from '@saveria/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Body, Field, PrimaryButton } from '../../../../features/auth/components';
import { previewAdjustment } from '../../../../features/transactions/adjustment';
import { refreshLedger, useLedger } from '../../../../features/transactions/ledger';
import { transactionService } from '../../../../features/transactions/transaction-service';
import { type Theme, useStyles } from '../../../../theme';
import { Page } from '../../../../ui/Page';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    difference: { ...t.type.bodyStrong, fontSize: 16, color: t.colors.text },
    hint: { ...t.type.caption, color: t.colors.textMuted },
  });

/**
 * Ajustar el saldo de una cuenta de dinero (historia 6). El usuario escribe el saldo real y
 * Saveria crea un movimiento de ajuste por la diferencia, sin modificar los movimientos anteriores.
 */
export default function AdjustBalance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles(makeStyles);
  const account = useLedger((s) => s.accounts.find((a) => a.id === id));
  const balance = useLedger((s) => (id ? s.balances[id] : undefined));
  const [realText, setRealText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => refreshLedger(), []);
  if (!account || !id) return null;

  const current = balance ?? account.initialBalance;
  const show = (amount: string) => formatAmount(amount, account.currency);
  const preview =
    realText.trim() === '' ? null : previewAdjustment(current, realText, account.currency);
  const canAdjust = preview?.status === 'diff';

  function adjust() {
    const result = transactionService.adjustTo(id as string, realText);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    router.back();
  }

  return (
    <Page title={`Ajustar ${account.name}`} back>
      <Body>{`Saldo actual: ${show(current)} ${account.currency}`}</Body>
      <Field
        label="Saldo real"
        value={realText}
        onChangeText={(text) => {
          setRealText(text);
          setErrors({});
        }}
        keyboardType="numbers-and-punctuation"
        placeholder="115.000"
        autoFocus
        error={preview?.status === 'invalid' ? preview.error : errors.amount}
      />
      {preview?.status === 'diff' ? (
        <Text style={styles.difference}>{`Diferencia: ${show(preview.difference)}`}</Text>
      ) : null}
      {preview?.status === 'same' ? (
        <Body muted>El saldo ya coincide: no se crea ningún ajuste</Body>
      ) : null}
      <Text style={styles.hint}>
        Se registra un ajuste por la diferencia. Tus movimientos anteriores no cambian.
      </Text>
      <PrimaryButton label="Ajustar saldo" onPress={adjust} disabled={!canAdjust} />
    </Page>
  );
}
