import { formatAmount } from '@saveria/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { styles as base, Field, PrimaryButton } from '../../../../features/auth/components';
import { previewAdjustment } from '../../../../features/transactions/adjustment';
import { refreshLedger, useLedger } from '../../../../features/transactions/ledger';
import { transactionService } from '../../../../features/transactions/transaction-service';

/**
 * Ajustar el saldo de una cuenta de dinero (historia 6). El usuario escribe el saldo real y
 * Saveria crea un movimiento de ajuste por la diferencia, sin modificar los movimientos anteriores.
 */
export default function AdjustBalance() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text role="heading" style={base.title}>
        {`Ajustar ${account.name}`}
      </Text>
      <Text>{`Saldo actual: ${show(current)} ${account.currency}`}</Text>
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
        <Text style={base.optionLabel}>{`Diferencia: ${show(preview.difference)}`}</Text>
      ) : null}
      {preview?.status === 'same' ? (
        <Text style={base.bannerText}>El saldo ya coincide: no se crea ningún ajuste</Text>
      ) : null}
      <Text style={styles.hint}>
        Se registra un ajuste por la diferencia. Tus movimientos anteriores no cambian.
      </Text>
      <PrimaryButton label="Ajustar saldo" onPress={adjust} disabled={!canAdjust} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 48, gap: 12 },
  hint: { color: '#4b5563', fontSize: 13 },
});
