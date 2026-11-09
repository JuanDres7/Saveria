import { DESCRIPTION_MAX, localToday } from '@saveria/shared';
import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';
import type { LocalAccountRecord } from '../accounts/local-accounts';
import { styles as base, Field, PrimaryButton } from '../auth/components';
import { Chip, chipRow } from './Chip';
import type { TransferForm } from './transaction-service';

function yesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localToday(date);
}

export interface TransferFormViewProps {
  title: string;
  submitLabel: string;
  initial: TransferForm;
  /** Cuentas que se pueden elegir (al editar incluye las actuales aunque estén archivadas). */
  accounts: readonly LocalAccountRecord[];
  /** Devuelve los errores por campo, o `null` si se guardó. */
  onSubmit(form: TransferForm): Record<string, string> | null;
  /** Acción secundaria bajo el botón principal (por ejemplo, "Borrar"). */
  footerExtra?: React.ReactNode;
}

/**
 * Formulario de una transferencia, compartido por "Transferir" y "Editar" (historia 5). El destino
 * nunca ofrece la cuenta de origen (5.4). Con monedas distintas pide los dos montos, sin calcular
 * ninguna tasa (5.3). No tiene categoría (5.2).
 */
export function TransferFormView({
  title,
  submitLabel,
  initial,
  accounts,
  onSubmit,
  footerExtra,
}: TransferFormViewProps) {
  const [fromId, setFromId] = useState<string | null>(initial.fromAccountId);
  const [toId, setToId] = useState<string | null>(initial.toAccountId);
  const [amountText, setAmountText] = useState(initial.amountText);
  const [toAmountText, setToAmountText] = useState(initial.toAmountText);
  const [occurredOn, setOccurredOn] = useState(initial.occurredOn);
  const [description, setDescription] = useState(initial.description);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const from = accounts.find((a) => a.id === fromId) ?? null;
  const to = accounts.find((a) => a.id === toId) ?? null;
  const crossCurrency = from !== null && to !== null && from.currency !== to.currency;
  const today = localToday();
  const otherDay = occurredOn !== today && occurredOn !== yesterday();

  function chooseFrom(account: LocalAccountRecord) {
    setFromId(account.id);
    // Si el origen pasa a ser la cuenta de destino, el destino se vacía (5.4).
    if (toId === account.id) setToId(null);
  }

  function submit() {
    const result = onSubmit({
      fromAccountId: fromId,
      toAccountId: toId,
      amountText,
      toAmountText,
      occurredOn,
      description,
    });
    if (result) setErrors(result);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text role="heading" style={base.title}>
          {title}
        </Text>

        <Text style={base.label}>Desde</Text>
        <View style={chipRow}>
          {accounts.map((account) => (
            <Chip
              key={account.id}
              label={account.name}
              checked={fromId === account.id}
              onPress={() => chooseFrom(account)}
            />
          ))}
        </View>
        {errors.accountId ? <Text style={base.error}>{errors.accountId}</Text> : null}

        <Text style={base.label}>Hacia</Text>
        <View style={chipRow}>
          {accounts
            .filter((account) => account.id !== fromId)
            .map((account) => (
              <Chip
                key={account.id}
                label={account.name}
                accessibilityLabel={`Hacia ${account.name}`}
                checked={toId === account.id}
                onPress={() => setToId(account.id)}
              />
            ))}
        </View>
        {errors.toAccountId ? <Text style={base.error}>{errors.toAccountId}</Text> : null}

        <Field
          label={crossCurrency && from ? `Monto que sale (${from.currency})` : 'Monto'}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="100.000"
          error={errors.amount}
        />
        {crossCurrency && to ? (
          <>
            <Text style={base.bannerText}>
              Cada cuenta usa su moneda: no se calcula ninguna tasa
            </Text>
            <Field
              label={`Monto que entra (${to.currency})`}
              value={toAmountText}
              onChangeText={setToAmountText}
              keyboardType="decimal-pad"
              error={errors.toAmount}
            />
          </>
        ) : null}

        <Text style={base.label}>Fecha</Text>
        <View style={chipRow}>
          <Chip label="Hoy" checked={occurredOn === today} onPress={() => setOccurredOn(today)} />
          <Chip
            label="Ayer"
            checked={occurredOn === yesterday()}
            onPress={() => setOccurredOn(yesterday())}
          />
        </View>
        <Field
          label="Otra fecha (AAAA-MM-DD)"
          value={otherDay ? occurredOn : ''}
          onChangeText={(text) => setOccurredOn(text || today)}
          placeholder="2026-10-01"
          error={errors.occurredOn}
        />

        <Field
          label="Descripción (opcional)"
          value={description}
          onChangeText={setDescription}
          maxLength={DESCRIPTION_MAX}
          autoCapitalize="sentences"
          error={errors.description}
        />
        {errors.body ? <Text style={base.error}>{errors.body}</Text> : null}
      </ScrollView>
      {/* Fuera del área que se desplaza: el botón siempre queda a la vista. */}
      <View style={styles.footer}>
        <PrimaryButton
          label={submitLabel}
          onPress={() => {
            Keyboard.dismiss();
            submit();
          }}
        />
        {footerExtra}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, gap: 12 },
  footer: {
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
});
