import { formatAmount } from '@saveria/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles } from '../../theme';
import { Icon } from '../../ui/Icon';
import { Banknote, Landmark, type LucideIcon, Smartphone } from '../../ui/icons';
import { FieldError } from '../auth/components';
import type { AccountBalance } from '../transactions/ledger';

const TYPE_ICONS: Record<string, LucideIcon> = {
  cash: Banknote,
  wallet: Smartphone,
  bank: Landmark,
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      minHeight: t.touch,
      gap: 6,
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surfaceSoft,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.sage,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1, gap: 1 },
    name: { ...t.type.bodyStrong, fontWeight: '500', color: t.colors.text },
    hint: { ...t.type.caption, color: t.colors.primary },
    balance: { ...t.type.amount, color: t.colors.text },
    negative: { color: t.colors.negative, fontWeight: '600' },
  });

/** Tarjetas de cuentas con su saldo; al tocarlas se abre el detalle de la cuenta. */
export function AccountList({ items }: { items: readonly AccountBalance[] }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={{ gap: 10 }}>
      {items.map(({ account, balance, negative }) => (
        <Pressable
          key={account.id}
          role="button"
          accessibilityLabel={`Abrir ${account.name}`}
          onPress={() => router.push(`/accounts/${account.id}`)}
          style={styles.card}
        >
          <View style={styles.row}>
            <View style={styles.icon}>
              <Icon icon={TYPE_ICONS[account.type] ?? Banknote} color="primary" size={18} />
            </View>
            <View style={styles.text}>
              <Text style={styles.name}>{account.name}</Text>
              {account.isDefault ? <Text style={styles.hint}>Cuenta por defecto</Text> : null}
            </View>
            <Text style={[styles.balance, negative ? styles.negative : null]}>
              {`${formatAmount(balance, account.currency)} ${account.currency}`}
            </Text>
          </View>
          {account.syncState === 'rejected' ? (
            <FieldError message={`No se pudo guardar: ${account.syncError ?? ''}`} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
