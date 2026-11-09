import { localToday } from '@saveria/shared';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { refreshLedger, useLedger } from '../../../features/transactions/ledger';
import { TransactionForm } from '../../../features/transactions/TransactionForm';
import { transactionService } from '../../../features/transactions/transaction-service';

/**
 * Registrar un gasto o un ingreso (historia 1). Abre con "gasto", la cuenta por defecto y hoy:
 * un gasto típico es escribir el monto, tocar la categoría y "Guardar" (FR-002, SC-001).
 */
export default function NewTransaction() {
  const accounts = useLedger((s) => s.accounts);
  const active = useMemo(() => accounts.filter((a) => a.archivedAt === null), [accounts]);
  const defaultAccount = active.find((a) => a.isDefault) ?? active[0] ?? null;

  useEffect(() => refreshLedger(), []);

  return (
    <TransactionForm
      // Al cargar las cuentas cambia la cuenta por defecto: se vuelve a abrir con ella elegida.
      key={defaultAccount?.id ?? 'sin-cuenta'}
      title="Registrar movimiento"
      submitLabel="Guardar"
      autoFocusAmount
      accounts={active}
      initial={{
        type: 'expense',
        amountText: '',
        accountId: defaultAccount?.id ?? null,
        categorySlug: null,
        occurredOn: localToday(),
        description: '',
      }}
      onSubmit={(form) => {
        const result = transactionService.record(form);
        if (!result.ok) return result.errors;
        router.back();
        return null;
      }}
    />
  );
}
