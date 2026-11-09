import { categoriesFor, DESCRIPTION_MAX, localToday } from '@saveria/shared';
import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LocalAccountRecord } from '../accounts/local-accounts';
import { styles as base, Field, PrimaryButton } from '../auth/components';
import { Chip, chipRow } from './Chip';
import type { RecordForm } from './transaction-service';

export type FormKind = RecordForm['type'];

function yesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localToday(date);
}

export interface TransactionFormProps {
  title: string;
  submitLabel: string;
  /** Valores con los que abre el formulario. */
  initial: RecordForm;
  /** Cuentas que se pueden elegir (al editar incluye la actual aunque esté archivada). */
  accounts: readonly LocalAccountRecord[];
  /** Devuelve los errores por campo, o `null` si se guardó. */
  onSubmit(form: RecordForm): Record<string, string> | null;
  /**
   * Al editar, cambiar a una cuenta de otra moneda vacía el monto: no se convierte solo y hay que
   * escribirlo en la nueva moneda (FR-025).
   */
  clearAmountOnCurrencyChange?: boolean;
  autoFocusAmount?: boolean;
  /** Acción secundaria bajo "Guardar" (por ejemplo, "Borrar"). */
  footerExtra?: React.ReactNode;
}

/**
 * Formulario de un gasto o un ingreso, compartido por "Registrar" y "Editar" (historias 1 y 4).
 * "Guardar" queda fijo abajo, fuera del área que se desplaza, para que el teclado no lo tape.
 */
export function TransactionForm({
  title,
  submitLabel,
  initial,
  accounts,
  onSubmit,
  clearAmountOnCurrencyChange = false,
  autoFocusAmount = false,
  footerExtra,
}: TransactionFormProps) {
  const [kind, setKind] = useState<FormKind>(initial.type);
  const [amountText, setAmountText] = useState(initial.amountText);
  const [categorySlug, setCategorySlug] = useState<string | null>(initial.categorySlug);
  const [accountId, setAccountId] = useState<string | null>(initial.accountId);
  const [occurredOn, setOccurredOn] = useState(initial.occurredOn);
  const [description, setDescription] = useState(initial.description);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currencyNotice, setCurrencyNotice] = useState<string | null>(null);

  const today = localToday();
  const otherDay = occurredOn !== today && occurredOn !== yesterday();

  function changeKind(next: FormKind) {
    setKind(next);
    // Una categoría de gasto no sirve para un ingreso (FR-004).
    setCategorySlug(null);
  }

  function chooseAccount(next: LocalAccountRecord) {
    const current = accounts.find((a) => a.id === accountId);
    if (clearAmountOnCurrencyChange && current && current.currency !== next.currency) {
      setAmountText('');
      setCurrencyNotice(`El monto no se convierte solo: escríbelo en ${next.currency}`);
    } else if (current?.currency === next.currency) {
      setCurrencyNotice(null);
    }
    setAccountId(next.id);
  }

  function submit() {
    const result = onSubmit({
      type: kind,
      amountText,
      accountId,
      categorySlug,
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

        <View style={chipRow}>
          <Chip label="Gasto" checked={kind === 'expense'} onPress={() => changeKind('expense')} />
          <Chip label="Ingreso" checked={kind === 'income'} onPress={() => changeKind('income')} />
        </View>

        <Field
          label="Monto"
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          autoFocus={autoFocusAmount}
          placeholder="18.000"
          error={errors.amount}
        />
        {currencyNotice ? <Text style={base.bannerText}>{currencyNotice}</Text> : null}

        <Text style={base.label}>Categoría</Text>
        <View style={chipRow}>
          {categoriesFor(kind).map((category) => (
            <Chip
              key={category.slug}
              label={category.name}
              checked={categorySlug === category.slug}
              onPress={() => {
                setCategorySlug(category.slug);
                // El monto ya está escrito: se cierra el teclado para dejar "Guardar" a la vista.
                Keyboard.dismiss();
              }}
            />
          ))}
        </View>
        {errors.categorySlug ? <Text style={base.error}>{errors.categorySlug}</Text> : null}

        <Text style={base.label}>Cuenta</Text>
        <View style={chipRow}>
          {accounts.map((account) => (
            <Chip
              key={account.id}
              label={account.name}
              checked={accountId === account.id}
              onPress={() => chooseAccount(account)}
            />
          ))}
        </View>
        {errors.accountId ? <Text style={base.error}>{errors.accountId}</Text> : null}

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
      {/* Fuera del área que se desplaza: "Guardar" siempre queda a la vista (FR-002). */}
      <View style={styles.footer}>
        <PrimaryButton label={submitLabel} onPress={submit} />
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
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
});
