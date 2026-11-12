import { router } from 'expo-router';
import { useEffect } from 'react';
import { AccountList } from '../../../features/accounts/AccountList';
import { PrimaryButton, TextButton } from '../../../features/auth/components';
import { refreshLedger, summarizeAccounts, useLedger } from '../../../features/transactions/ledger';
import { useSession } from '../../../session/session-store';
import { Page } from '../../../ui/Page';

/** Cuentas de dinero activas con su saldo (historia 3). Es una sección de la barra inferior. */
export default function Accounts() {
  const primary = useSession((s) => s.me?.profile.primaryCurrency) ?? null;
  const accounts = useLedger((s) => s.accounts);
  const balances = useLedger((s) => s.balances);
  useEffect(() => refreshLedger(), []);

  const { active } = summarizeAccounts(accounts, balances, primary);

  return (
    <Page title="Cuentas de dinero">
      <AccountList items={active} />
      <PrimaryButton label="Nueva cuenta" onPress={() => router.push('/accounts/new')} />
      <TextButton label="Cuentas archivadas" onPress={() => router.push('/accounts/archived')} />
    </Page>
  );
}
