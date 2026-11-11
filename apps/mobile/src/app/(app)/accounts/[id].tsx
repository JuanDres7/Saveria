import { formatAmount } from '@saveria/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AccountFields, GeneralErrors } from '../../../features/accounts/AccountFields';
import { type AccountForm, accountService } from '../../../features/accounts/account-service';
import { styles as base, PrimaryButton, TextButton } from '../../../features/auth/components';
import { openLedgerContext, refreshLedger, useLedger } from '../../../features/transactions/ledger';
import { colors } from '../../../theme';

/**
 * Detalle de una cuenta de dinero (historia 3): editar, volverla la cuenta por defecto, archivar
 * (avisando el saldo) o reactivar.
 */
export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useLedger((s) => s.accounts.find((a) => a.id === id));
  const balance = useLedger((s) => (id ? s.balances[id] : undefined));
  const [form, setForm] = useState<AccountForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => refreshLedger(), []);
  useEffect(() => {
    if (account && form === null) {
      setForm({
        name: account.name,
        type: account.type,
        currency: account.currency,
        initialBalanceText: account.initialBalance,
      });
    }
  }, [account, form]);

  if (!account || !form || !id) return null;
  const archived = account.archivedAt !== null;
  const hasTransactions = openLedgerContext()?.ledger.existsForAccount(id) ?? false;
  const shownBalance = `${formatAmount(balance ?? account.initialBalance, account.currency)} ${account.currency}`;

  /** Muestra los errores o, si salió bien, vuelve atrás. */
  function done(result: ReturnType<typeof accountService.update>) {
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    router.back();
  }

  function startArchive() {
    // La cuenta por defecto no se archiva: el servicio responde con el motivo (3.7).
    if (account?.isDefault) {
      done(accountService.archive(id));
      return;
    }
    setConfirmArchive(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text role="heading" style={base.title}>
        {account.name}
      </Text>
      <Text>{`Saldo: ${shownBalance}`}</Text>
      {archived ? <Text style={styles.hint}>Esta cuenta está archivada.</Text> : null}
      {account.isDefault ? <Text style={styles.hint}>Cuenta por defecto</Text> : null}

      <AccountFields
        form={form}
        onChange={setForm}
        errors={errors}
        currencyLocked={hasTransactions}
      />
      <GeneralErrors errors={errors} />

      {archived ? (
        <PrimaryButton
          label="Reactivar"
          onPress={() => done(accountService.unarchive(id, form.name))}
        />
      ) : (
        <>
          <PrimaryButton
            label="Guardar cambios"
            onPress={() => done(accountService.update(id, form))}
          />
          <TextButton
            label="Registrar movimiento"
            onPress={() => router.push('/transactions/new')}
          />
          <TextButton label="Ajustar saldo" onPress={() => router.push(`/accounts/${id}/adjust`)} />
          <TextButton
            label="Transferir desde esta cuenta"
            onPress={() => router.push(`/transfer?from=${id}`)}
          />
          {account.isDefault ? null : (
            <TextButton
              label="Usar como cuenta por defecto"
              onPress={() => done(accountService.setDefault(id))}
            />
          )}
          {confirmArchive ? (
            <View style={base.banner}>
              <Text style={base.bannerText}>
                {`Esta cuenta tiene ${shownBalance}. Al archivarla deja de sumar en el total y no aparece al registrar movimientos; sus movimientos se conservan.`}
              </Text>
              <TextButton label="Sí, archivar" onPress={() => done(accountService.archive(id))} />
              <TextButton label="Cancelar" onPress={() => setConfirmArchive(false)} />
            </View>
          ) : (
            <TextButton label="Archivar" onPress={startArchive} />
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 48, gap: 12 },
  hint: { color: colors.primary },
});
