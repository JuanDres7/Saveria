import { categoryBySlug, formatAmount } from '@saveria/shared';
import { StyleSheet, Text, View } from 'react-native';
import type { LocalAccountRecord } from '../accounts/local-accounts';
import { styles as base } from '../auth/components';
import type { LocalTransactionRecord } from './local-transactions';

const TYPE_LABELS: Record<LocalTransactionRecord['type'], string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
  adjustment: 'Ajuste de saldo',
};

/** Qué se muestra como título de un movimiento: su categoría, o su tipo si no tiene. */
export function transactionTitle(tx: LocalTransactionRecord): string {
  const category = tx.categorySlug ? categoryBySlug(tx.categorySlug) : undefined;
  return category?.name ?? TYPE_LABELS[tx.type];
}

/** Un movimiento: título, monto, cuenta, fecha y, si el servidor lo rechazó, el motivo (FR-037). */
export function TransactionRow({
  tx,
  accounts,
}: {
  tx: LocalTransactionRecord;
  accounts: readonly LocalAccountRecord[];
}) {
  const account = accounts.find((a) => a.id === tx.accountId);
  const sign = tx.type === 'expense' ? '-' : '';
  return (
    <View style={styles.row} accessibilityLabel={`${transactionTitle(tx)} ${tx.amount}`}>
      <View style={styles.line}>
        <Text style={base.optionLabel}>{transactionTitle(tx)}</Text>
        <Text style={tx.type === 'expense' ? styles.expense : styles.income}>
          {`${sign}${formatAmount(tx.amount, tx.currency)}`}
        </Text>
      </View>
      <Text style={styles.detail}>
        {[account?.name, tx.occurredOn, tx.description].filter(Boolean).join(' · ')}
      </Text>
      {tx.syncState === 'rejected' ? (
        <Text style={base.error}>{`No se pudo guardar: ${tx.syncError ?? ''}`}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 8, gap: 2 },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  detail: { color: '#4b5563', fontSize: 13 },
  expense: { color: '#b91c1c', fontWeight: '600' },
  income: { color: '#047857', fontWeight: '600' },
});
