import { categoryBySlug, formatAmount } from '@saveria/shared';
import { StyleSheet, Text, View } from 'react-native';
import type { LocalAccountRecord } from '../accounts/local-accounts';
import { styles as base } from '../auth/components';
import type { DaySection } from './ledger';
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

type Tone = 'out' | 'in' | 'neutral';

/**
 * Monto con signo visto desde una cuenta. Un gasto sale y un ingreso entra. Una transferencia
 * sale de su cuenta de origen y entra a la de destino (con su propio monto y moneda); sin
 * cuenta de referencia se muestra sin signo. Un ajuste ya trae su signo.
 */
function signedAmount(tx: LocalTransactionRecord, fromAccountId?: string): [string, Tone] {
  switch (tx.type) {
    case 'expense':
      return [`-${formatAmount(tx.amount, tx.currency)}`, 'out'];
    case 'income':
      return [formatAmount(tx.amount, tx.currency), 'in'];
    case 'adjustment':
      return [formatAmount(tx.amount, tx.currency), tx.amount.startsWith('-') ? 'out' : 'in'];
    case 'transfer':
      if (fromAccountId === tx.toAccountId && tx.toAmount && tx.toCurrency) {
        return [`+${formatAmount(tx.toAmount, tx.toCurrency)}`, 'in'];
      }
      if (fromAccountId === tx.accountId)
        return [`-${formatAmount(tx.amount, tx.currency)}`, 'out'];
      return [formatAmount(tx.amount, tx.currency), 'neutral'];
  }
}

/**
 * Un movimiento: título, monto, cuenta (u origen → destino) y descripción. La fecha la da el
 * encabezado del día. Si el servidor lo rechazó, muestra el motivo (FR-037).
 */
export function TransactionRow({
  tx,
  accounts,
  fromAccountId,
}: {
  tx: LocalTransactionRecord;
  accounts: readonly LocalAccountRecord[];
  /** Cuenta desde la que se mira (filtro del historial), para el signo de las transferencias. */
  fromAccountId?: string;
}) {
  const name = (id: string | null) => accounts.find((a) => a.id === id)?.name;
  const where =
    tx.type === 'transfer' ? `${name(tx.accountId)} → ${name(tx.toAccountId)}` : name(tx.accountId);
  const [amount, tone] = signedAmount(tx, fromAccountId);
  return (
    <View style={styles.row} accessibilityLabel={`${transactionTitle(tx)} ${tx.amount}`}>
      <View style={styles.line}>
        <Text style={base.optionLabel}>{transactionTitle(tx)}</Text>
        <Text style={styles[tone]}>{amount}</Text>
      </View>
      <Text style={styles.detail}>{[where, tx.description].filter(Boolean).join(' · ')}</Text>
      {tx.syncState === 'rejected' ? (
        <Text style={base.error}>{`No se pudo guardar: ${tx.syncError ?? ''}`}</Text>
      ) : null}
    </View>
  );
}

/** Encabezado de un día ("Hoy", "Ayer", "1 de octubre de 2026"). */
export function DayHeader({ title }: { title: string }) {
  return (
    <Text accessibilityRole="header" style={styles.header}>
      {title}
    </Text>
  );
}

/** Movimientos agrupados por día, sin desplazamiento propio (para Inicio). */
export function DaySections({
  sections,
  accounts,
}: {
  sections: readonly DaySection[];
  accounts: readonly LocalAccountRecord[];
}) {
  return (
    <View>
      {sections.map((section) => (
        <View key={section.day}>
          <DayHeader title={section.title} />
          {section.data.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} accounts={accounts} />
          ))}
        </View>
      ))}
    </View>
  );
}

export const NEGATIVE_COLOR = '#b91c1c';

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 8, gap: 2 },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  detail: { color: '#4b5563', fontSize: 13 },
  header: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 12 },
  out: { color: NEGATIVE_COLOR, fontWeight: '600' },
  in: { color: '#047857', fontWeight: '600' },
  neutral: { color: '#111827', fontWeight: '600' },
});
