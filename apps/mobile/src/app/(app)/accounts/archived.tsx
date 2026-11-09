import { toE4 } from '@saveria/shared';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { AccountList } from '../../../features/accounts/AccountList';
import { styles as base } from '../../../features/auth/components';
import { refreshLedger, useLedger } from '../../../features/transactions/ledger';

/**
 * Cuentas archivadas con su saldo (FR-021): no suman en el total ni aparecen al registrar, pero
 * se pueden abrir para ver sus datos o reactivarlas.
 */
export default function ArchivedAccounts() {
  const accounts = useLedger((s) => s.accounts);
  const balances = useLedger((s) => s.balances);
  useEffect(() => refreshLedger(), []);

  const archived = accounts
    .filter((a) => a.archivedAt !== null)
    .map((account) => {
      const balance = balances[account.id] ?? account.initialBalance;
      return { account, balance, negative: toE4(balance) < 0n };
    });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text role="heading" style={base.title}>
        Cuentas archivadas
      </Text>
      {archived.length === 0 ? <Text>No tienes cuentas archivadas.</Text> : null}
      <AccountList items={archived} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 24, paddingTop: 48, gap: 12 } });
