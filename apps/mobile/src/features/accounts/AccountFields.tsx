import { type AccountType, CURRENCIES } from '@saveria/shared';
import { View } from 'react-native';
import { Body, Field, FieldError } from '../auth/components';
import { Chip, chipRow } from '../transactions/Chip';
import { FormLabel } from '../transactions/form-parts';
import type { AccountForm } from './account-service';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Efectivo',
  wallet: 'Billetera digital',
  bank: 'Banco',
};

/**
 * Campos de una cuenta de dinero: nombre, tipo, moneda y saldo inicial. Con `currencyLocked` la
 * moneda no se puede cambiar porque la cuenta ya tiene movimientos (FR-019).
 */
export function AccountFields({
  form,
  onChange,
  errors,
  currencyLocked = false,
}: {
  form: AccountForm;
  onChange(form: AccountForm): void;
  errors: Record<string, string>;
  currencyLocked?: boolean;
}) {
  const set = (changes: Partial<AccountForm>) => onChange({ ...form, ...changes });
  return (
    <View style={{ gap: 12 }}>
      <Field
        label="Nombre"
        value={form.name}
        onChangeText={(name) => set({ name })}
        maxLength={40}
        autoCapitalize="words"
        error={errors.name}
      />

      <FormLabel label="Tipo" />
      <View style={chipRow}>
        {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((type) => (
          <Chip
            key={type}
            label={ACCOUNT_TYPE_LABELS[type]}
            checked={form.type === type}
            onPress={() => set({ type })}
          />
        ))}
      </View>

      <FormLabel label="Moneda" />
      {currencyLocked ? (
        <>
          <Body>{form.currency}</Body>
          <FieldError message="No puedes cambiar la moneda de una cuenta que ya tiene movimientos" />
        </>
      ) : (
        <View style={chipRow}>
          {CURRENCIES.map((currency) => (
            <Chip
              key={currency.code}
              label={currency.code}
              checked={form.currency === currency.code}
              onPress={() => set({ currency: currency.code })}
            />
          ))}
        </View>
      )}
      {errors.currency ? <FieldError message={errors.currency} /> : null}

      <Field
        label="Saldo inicial"
        value={form.initialBalanceText}
        onChangeText={(initialBalanceText) => set({ initialBalanceText })}
        keyboardType="numbers-and-punctuation"
        placeholder="0"
        error={errors.initialBalance}
      />
    </View>
  );
}

/** Errores que no son de un campo (límite de cuentas, archivar, cuenta por defecto). */
export function GeneralErrors({ errors }: { errors: Record<string, string> }) {
  const general = ['account', 'archivedAt', 'isDefault', 'body']
    .map((key) => errors[key])
    .filter(Boolean);
  return (
    <>
      {general.map((message) => (
        <FieldError key={message} message={message ?? ''} />
      ))}
    </>
  );
}
