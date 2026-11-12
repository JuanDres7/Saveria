import { router } from 'expo-router';
import { useState } from 'react';
import { AccountFields, GeneralErrors } from '../../../features/accounts/AccountFields';
import { type AccountForm, accountService } from '../../../features/accounts/account-service';
import { PrimaryButton, RadioOption } from '../../../features/auth/components';
import { useSession } from '../../../session/session-store';
import { Page } from '../../../ui/Page';

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
    <Page title="Nueva cuenta de dinero" back>
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
    </Page>
  );
}
