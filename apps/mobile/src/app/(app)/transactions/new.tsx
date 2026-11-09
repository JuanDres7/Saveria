import { categoriesFor, DESCRIPTION_MAX, localToday } from '@saveria/shared';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { styles as base, Field, PrimaryButton } from '../../../features/auth/components';
import { refreshLedger, useLedger } from '../../../features/transactions/ledger';
import { transactionService } from '../../../features/transactions/transaction-service';

type Kind = 'expense' | 'income';

function yesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localToday(date);
}

/** Opción compacta (tipo, categoría, cuenta, fecha): selección única. */
function Chip({ label, checked, onPress }: { label: string; checked: boolean; onPress(): void }) {
  return (
    <Pressable
      role="radio"
      aria-checked={checked}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, checked ? styles.chipChecked : null]}
    >
      <Text style={checked ? styles.chipTextChecked : null}>{label}</Text>
    </Pressable>
  );
}

/**
 * Registrar un gasto o un ingreso (historia 1). Abre con "gasto", la cuenta por defecto y hoy:
 * un gasto típico es escribir el monto, tocar la categoría y "Guardar" (FR-002, SC-001).
 */
export default function NewTransaction() {
  const accounts = useLedger((s) => s.accounts);
  const active = useMemo(() => accounts.filter((a) => a.archivedAt === null), [accounts]);
  const defaultAccount = active.find((a) => a.isDefault) ?? active[0] ?? null;

  const [kind, setKind] = useState<Kind>('expense');
  const [amountText, setAmountText] = useState('');
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [occurredOn, setOccurredOn] = useState(localToday());
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => refreshLedger(), []);

  const selectedAccountId = accountId ?? defaultAccount?.id ?? null;
  const today = localToday();
  const otherDay = occurredOn !== today && occurredOn !== yesterday();

  function changeKind(next: Kind) {
    setKind(next);
    // Una categoría de gasto no sirve para un ingreso (FR-004).
    setCategorySlug(null);
  }

  function save() {
    const result = transactionService.record({
      type: kind,
      amountText,
      accountId: selectedAccountId,
      categorySlug,
      occurredOn,
      description,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text role="heading" style={base.title}>
        Registrar movimiento
      </Text>

      <View style={styles.row}>
        <Chip label="Gasto" checked={kind === 'expense'} onPress={() => changeKind('expense')} />
        <Chip label="Ingreso" checked={kind === 'income'} onPress={() => changeKind('income')} />
      </View>

      <Field
        label="Monto"
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        autoFocus
        placeholder="18.000"
        error={errors.amount}
      />

      <Text style={base.label}>Categoría</Text>
      <View style={styles.row}>
        {categoriesFor(kind).map((category) => (
          <Chip
            key={category.slug}
            label={category.name}
            checked={categorySlug === category.slug}
            onPress={() => setCategorySlug(category.slug)}
          />
        ))}
      </View>
      {errors.categorySlug ? <Text style={base.error}>{errors.categorySlug}</Text> : null}

      <Text style={base.label}>Cuenta</Text>
      <View style={styles.row}>
        {active.map((account) => (
          <Chip
            key={account.id}
            label={account.name}
            checked={selectedAccountId === account.id}
            onPress={() => setAccountId(account.id)}
          />
        ))}
      </View>
      {errors.accountId ? <Text style={base.error}>{errors.accountId}</Text> : null}

      <Text style={base.label}>Fecha</Text>
      <View style={styles.row}>
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

      <PrimaryButton label="Guardar" onPress={save} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#9ca3af',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipChecked: { borderColor: '#0f766e', backgroundColor: '#0f766e' },
  chipTextChecked: { color: '#ffffff', fontWeight: '600' },
});
