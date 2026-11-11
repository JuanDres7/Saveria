import { DESCRIPTION_MAX, localToday } from '@saveria/shared';
import { useState } from 'react';
import { Keyboard, View } from 'react-native';
import type { LocalAccountRecord } from '../accounts/local-accounts';
import { Banner, Field, FieldError, PrimaryButton } from '../auth/components';
import { Chip, chipRow } from './Chip';
import { AmountField, FormLabel, FormScreen } from './form-parts';
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
    <FormScreen
      title={title}
      footer={
        // Fuera del área que se desplaza: el botón siempre queda a la vista.
        <>
          <PrimaryButton
            label={submitLabel}
            onPress={() => {
              Keyboard.dismiss();
              submit();
            }}
          />
          {footerExtra}
        </>
      }
    >
      <FormLabel label="Desde" />
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
      {errors.accountId ? <FieldError message={errors.accountId} /> : null}

      <FormLabel label="Hacia" />
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
      {errors.toAccountId ? <FieldError message={errors.toAccountId} /> : null}

      <AmountField
        label={crossCurrency && from ? `Monto que sale (${from.currency})` : 'Monto'}
        caption={from && !crossCurrency ? `Monto en ${from.currency}` : undefined}
        value={amountText}
        onChangeText={setAmountText}
        placeholder="100.000"
        error={errors.amount}
      />
      {crossCurrency && to ? (
        <>
          <Banner message="Cada cuenta usa su moneda: no se calcula ninguna tasa" />
          <Field
            label={`Monto que entra (${to.currency})`}
            value={toAmountText}
            onChangeText={setToAmountText}
            keyboardType="decimal-pad"
            error={errors.toAmount}
          />
        </>
      ) : null}

      <FormLabel label="Fecha" />
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
      {errors.body ? <FieldError message={errors.body} /> : null}
    </FormScreen>
  );
}
