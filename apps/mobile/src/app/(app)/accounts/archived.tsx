import { toE4 } from '@saveria/shared';
import { useEffect } from 'react';
import { AccountList } from '../../../features/accounts/AccountList';
import { Body } from '../../../features/auth/components';
import { refreshLedger, useLedger } from '../../../features/transactions/ledger';
import { Page } from '../../../ui/Page';

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
    <Page title="Cuentas archivadas" back>
      {archived.length === 0 ? <Body muted>No tienes cuentas archivadas.</Body> : null}
      <AccountList items={archived} />
    </Page>
  );
}
