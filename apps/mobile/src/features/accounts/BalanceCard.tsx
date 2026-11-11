import { formatAmount } from '@saveria/shared';
import { ArrowLeftRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles } from '../../theme';
import { Icon } from '../../ui/Icon';
import { Leaf } from '../../ui/Leaf';
import type { BalanceCardData } from './balance-card';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, gap: 4 },
    label: { ...t.type.caption, color: t.colors.onHeroMuted },
    figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    figure: { ...t.type.figure, color: t.colors.onHero, flexShrink: 1 },
    currency: { ...t.type.caption, fontWeight: '500', color: t.colors.onHeroMuted },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      gap: 8,
    },
    note: { ...t.type.caption, color: t.colors.onHeroMuted, flexShrink: 1 },
    transfer: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: t.colors.onHeroMuted,
      borderRadius: t.radius.pill,
      paddingHorizontal: 12,
    },
    transferText: { ...t.type.caption, fontWeight: '500', color: t.colors.onHero },
  });

// El botón mide 36 dp; esta zona extra suma el área de toque a 48 dp.
const HIT_SLOP = { top: 6, bottom: 6 } as const;

/**
 * Tarjeta grande de balance de Inicio, con la forma de hoja de la marca: el total, o el saldo de la
 * cuenta por defecto cuando hay cuentas en monedas distintas (FR-012), y «Transferir» cuando se puede.
 */
export function BalanceCard({
  card,
  onTransfer,
}: {
  card: BalanceCardData;
  onTransfer?: () => void;
}) {
  const styles = useStyles(makeStyles);
  const isTotal = card.kind === 'total';
  const amount = isTotal ? card.amount : card.balance;
  const currency = card.currency;
  const label = isTotal ? 'Tu balance total' : `Saldo de ${card.name}`;
  const accessibilityLabel = isTotal
    ? `Total: ${formatAmount(amount, currency)} ${currency}`
    : `${label}: ${formatAmount(amount, currency)} ${currency}`;
  const note = isTotal
    ? `En ${card.accountCount} ${card.accountCount === 1 ? 'cuenta' : 'cuentas'}`
    : card.otherCurrencies
      ? 'Tienes cuentas en otras monedas'
      : null;
  return (
    <Leaf variant="balance" testID="balance-card" style={styles.card}>
      <View accessible accessibilityLabel={accessibilityLabel}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.figureRow}>
          <Text
            testID="balance-figure"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={styles.figure}
          >
            {formatAmount(amount, currency)}
          </Text>
          <Text style={styles.currency}>{currency}</Text>
        </View>
      </View>
      {note || onTransfer ? (
        <View style={styles.footer}>
          <Text style={styles.note}>{note ?? ''}</Text>
          {onTransfer ? (
            <Pressable
              role="button"
              accessibilityLabel="Transferir"
              hitSlop={HIT_SLOP}
              onPress={onTransfer}
              style={styles.transfer}
            >
              <Icon icon={ArrowLeftRight} size={15} color="onHero" />
              <Text style={styles.transferText}>Transferir</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Leaf>
  );
}
