import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { AccountList } from '../../../features/accounts/AccountList';
import { styles as base, PrimaryButton, TextButton } from '../../../features/auth/components';
import { refreshLedger, summarizeAccounts, useLedger } from '../../../features/transactions/ledger';
import { useSession } from '../../../session/session-store';

/** Cuentas de dinero activas con su saldo (historia 3). */
export default function Accounts() {
  const primary = useSession((s) => s.me?.profile.primaryCurrency) ?? null;
  const accounts = useLedger((s) => s.accounts);
  const balances = useLedger((s) => s.balances);
  useEffect(() => refreshLedger(), []);

  const { active } = summarizeAccounts(accounts, balances, primary);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text role="heading" style={base.title}>
        Cuentas de dinero
      </Text>
      <AccountList items={active} />
      <PrimaryButton label="Nueva cuenta" onPress={() => router.push('/accounts/new')} />
      <TextButton label="Cuentas archivadas" onPress={() => router.push('/accounts/archived')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 24, paddingTop: 48, gap: 12 } });
