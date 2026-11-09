import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { AccountFields, GeneralErrors } from '../../../features/accounts/AccountFields';
import { type AccountForm, accountService } from '../../../features/accounts/account-service';
import { styles as base, PrimaryButton, RadioOption } from '../../../features/auth/components';
import { useSession } from '../../../session/session-store';

/** Crear una cuenta de dinero (3.1): la moneda viene preseleccionada con la principal (3.2). */
export default function NewAccount() {
  const primary = useSession((s) => s.me?.profile.primaryCurrency) ?? 'COP';
  const [form, setForm] = useState<AccountForm>({
    name: '',
    type: 'wallet',
    currency: primary,
    initialBalanceText: '',
  });
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function create() {
    const result = accountService.create(form, { isDefault });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text role="heading" style={base.title}>
        Nueva cuenta de dinero
      </Text>
      <AccountFields form={form} onChange={setForm} errors={errors} />
      <RadioOption
        role="checkbox"
        label="Usar como cuenta por defecto"
        description="Es la que aparece elegida al registrar un movimiento."
        checked={isDefault}
        onPress={() => setIsDefault(!isDefault)}
      />
      <GeneralErrors errors={errors} />
      <PrimaryButton label="Crear cuenta" onPress={create} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 24, paddingTop: 48, gap: 12 } });
