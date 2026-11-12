import { categoryBySlug } from '@saveria/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles } from '../../theme';
import { CategoryIcon } from '../../ui/CategoryIcon';
import { ADJUSTMENT_VISUAL, TRANSFER_VISUAL, visualForSlug } from '../../ui/category-icons';
import { formatMoney, MINUS } from '../../ui/money';
import type { LocalAccountRecord } from '../accounts/local-accounts';
import { FieldError, TextButton } from '../auth/components';
import type { DaySection } from './ledger';
import type { LocalTransactionRecord } from './local-transactions';
import { DELETE_REJECTED_PREFIX, transactionService } from './transaction-service';

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

/** El ícono y el tono de un movimiento: los de su categoría, o los de su tipo si no tiene. */
function transactionVisual(tx: LocalTransactionRecord) {
  if (tx.type === 'transfer') return TRANSFER_VISUAL;
  if (tx.type === 'adjustment') return ADJUSTMENT_VISUAL;
  return visualForSlug(tx.categorySlug);
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
      return [`${MINUS}${formatMoney(tx.amount, tx.currency)}`, 'out'];
    case 'income':
      return [`+${formatMoney(tx.amount, tx.currency)}`, 'in'];
    case 'adjustment':
      return tx.amount.startsWith('-')
        ? [formatMoney(tx.amount, tx.currency), 'out']
        : [`+${formatMoney(tx.amount, tx.currency)}`, 'in'];
    case 'transfer':
      if (fromAccountId === tx.toAccountId && tx.toAmount && tx.toCurrency) {
        return [`+${formatMoney(tx.toAmount, tx.toCurrency)}`, 'in'];
      }
      if (fromAccountId === tx.accountId)
        return [`${MINUS}${formatMoney(tx.amount, tx.currency)}`, 'out'];
      return [formatMoney(tx.amount, tx.currency), 'neutral'];
  }
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.divider,
      paddingVertical: 4,
      gap: 2,
    },
    content: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
    text: { flex: 1, gap: 1 },
    title: { ...t.type.bodyStrong, fontWeight: '500', color: t.colors.text },
    detail: { ...t.type.caption, color: t.colors.textMuted },
    amount: { ...t.type.amount, color: t.colors.text },
    // Un gasto va en el color del texto con su «−»; solo el ingreso lleva color propio (FR-008).
    in: { color: t.colors.positive, fontWeight: '700' },
    header: {
      ...t.type.caption,
      fontWeight: '700',
      color: t.colors.textMuted,
      marginTop: 12,
      marginBottom: 2,
    },
  });

/**
 * Un movimiento: ícono de su categoría, título, monto, cuenta (u origen → destino) y descripción. La
 * fecha la da el encabezado del día. Al tocarlo se abre para editarlo o borrarlo. Si el servidor lo
 * rechazó, muestra el motivo (FR-037); si lo rechazado fue un borrado, ofrece reintentarlo.
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
  const styles = useStyles(makeStyles);
  const name = (id: string | null) => accounts.find((a) => a.id === id)?.name;
  const where =
    tx.type === 'transfer' ? `${name(tx.accountId)} → ${name(tx.toAccountId)}` : name(tx.accountId);
  const [amount, tone] = signedAmount(tx, fromAccountId);
  const deleteRejected = tx.syncError?.startsWith(DELETE_REJECTED_PREFIX) ?? false;
  return (
    <View style={styles.row}>
      <Pressable
        role="button"
        accessibilityLabel={`${transactionTitle(tx)} ${tx.amount}`}
        onPress={() => router.push(`/transactions/${tx.id}`)}
        style={styles.content}
      >
        <CategoryIcon visual={transactionVisual(tx)} testID="category-icon" />
        <View style={styles.text}>
          <Text style={styles.title}>{transactionTitle(tx)}</Text>
          <Text style={styles.detail}>{[where, tx.description].filter(Boolean).join(' · ')}</Text>
        </View>
        <Text style={[styles.amount, tone === 'in' ? styles.in : null]}>{amount}</Text>
      </Pressable>
      {tx.syncState === 'rejected' ? (
        <FieldError
          message={
            deleteRejected ? (tx.syncError ?? '') : `No se pudo guardar: ${tx.syncError ?? ''}`
          }
        />
      ) : null}
      {tx.syncState === 'rejected' && deleteRejected ? (
        <TextButton label="Reintentar borrado" onPress={() => transactionService.remove(tx.id)} />
      ) : null}
    </View>
  );
}

/** Encabezado de un día ("Hoy", "Ayer", "1 de octubre de 2026"). */
export function DayHeader({ title }: { title: string }) {
  const styles = useStyles(makeStyles);
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
