import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { styles as base, TextButton } from '../../../features/auth/components';
import { openLedgerContext, refreshLedger, useLedger } from '../../../features/transactions/ledger';
import { transactionTitle } from '../../../features/transactions/RecentList';
import { TransactionForm } from '../../../features/transactions/TransactionForm';
import { TransferFormView } from '../../../features/transactions/TransferFormView';
import { transactionService } from '../../../features/transactions/transaction-service';
import { useUndo } from '../../../features/transactions/UndoSnackbar';

/**
 * Editar o borrar un movimiento (historia 4). Borrar es inmediato y ofrece "Deshacer": no pide
 * confirmación, para no sumar un toque (FR-026). El selector de cuenta incluye siempre la cuenta
 * actual del movimiento, aunque esté archivada.
 */
export default function EditTransaction() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accounts = useLedger((s) => s.accounts);
  useEffect(() => refreshLedger(), []);

  const transaction = openLedgerContext()?.ledger.findById(id ?? '') ?? null;
  const selectable = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.archivedAt === null ||
          account.id === transaction?.accountId ||
          account.id === transaction?.toAccountId,
      ),
    [accounts, transaction?.accountId, transaction?.toAccountId],
  );

  if (!transaction || transaction.deletedAt !== null) return null;

  function remove() {
    if (!transaction) return;
    transactionService.remove(transaction.id);
    useUndo.getState().offer(transaction.id);
    router.back();
  }

  const deleteButton = <TextButton label="Borrar" onPress={remove} />;

  if (transaction.type === 'transfer') {
    return (
      <TransferFormView
        key={transaction.id}
        title="Editar transferencia"
        submitLabel="Guardar cambios"
        accounts={selectable}
        initial={{
          fromAccountId: transaction.accountId,
          toAccountId: transaction.toAccountId,
          amountText: transaction.amount,
          toAmountText: transaction.toAmount ?? '',
          occurredOn: transaction.occurredOn,
          description: transaction.description ?? '',
        }}
        onSubmit={(form) => {
          const result = transactionService.updateTransfer(transaction.id, form);
          if (!result.ok) return result.errors;
          router.back();
          return null;
        }}
        footerExtra={deleteButton}
      />
    );
  }

  // Los ajustes se editan en su propia historia; aquí solo se pueden borrar.
  if (transaction.type !== 'expense' && transaction.type !== 'income') {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text role="heading" style={base.title}>
          {transactionTitle(transaction)}
        </Text>
        <Text>Este tipo de movimiento todavía no se puede editar, pero sí borrar.</Text>
        {deleteButton}
      </ScrollView>
    );
  }

  return (
    <TransactionForm
      key={transaction.id}
      title="Editar movimiento"
      submitLabel="Guardar cambios"
      clearAmountOnCurrencyChange
      accounts={selectable}
      initial={{
        type: transaction.type,
        amountText: transaction.amount,
        accountId: transaction.accountId,
        categorySlug: transaction.categorySlug,
        occurredOn: transaction.occurredOn,
        description: transaction.description ?? '',
      }}
      onSubmit={(form) => {
        const result = transactionService.update(transaction.id, form);
        if (!result.ok) return result.errors;
        router.back();
        return null;
      }}
      footerExtra={deleteButton}
    />
  );
}

const styles = StyleSheet.create({ content: { padding: 24, paddingTop: 48, gap: 12 } });
