import { localToday } from '@saveria/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { refreshLedger, useLedger } from '../../features/transactions/ledger';
import { TransferFormView } from '../../features/transactions/TransferFormView';
import { transactionService } from '../../features/transactions/transaction-service';

/**
 * Transferir entre dos cuentas de dinero (historia 5). El origen viene elegido: la cuenta por
 * defecto, o la cuenta desde la que se abrió la pantalla (`?from=`).
 */
export default function Transfer() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const accounts = useLedger((s) => s.accounts);
  const active = useMemo(() => accounts.filter((a) => a.archivedAt === null), [accounts]);
  const origin =
    active.find((a) => a.id === from) ?? active.find((a) => a.isDefault) ?? active[0] ?? null;

  useEffect(() => refreshLedger(), []);

  return (
    <TransferFormView
      // Al cargar las cuentas cambia el origen: se vuelve a abrir con él elegido.
      key={origin?.id ?? 'sin-cuenta'}
      title="Transferir"
      submitLabel="Transferir"
      accounts={active}
      initial={{
        fromAccountId: origin?.id ?? null,
        toAccountId: null,
        amountText: '',
        toAmountText: '',
        occurredOn: localToday(),
        description: '',
      }}
      onSubmit={(form) => {
        const result = transactionService.transfer(form);
        if (!result.ok) return result.errors;
        router.back();
        return null;
      }}
    />
  );
}
