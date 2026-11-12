import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles } from '../../theme';
import { Icon } from '../../ui/Icon';
import { Banknote, Landmark, type LucideIcon, Smartphone } from '../../ui/icons';
import { formatMoney } from '../../ui/money';
import { FieldError } from '../auth/components';
import type { AccountBalance } from '../transactions/ledger';

const TYPE_ICONS: Record<string, LucideIcon> = {
  cash: Banknote,
  wallet: Smartphone,
  bank: Landmark,
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    item: {
      minHeight: 56,
      justifyContent: 'center',
      gap: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.divider,
      paddingVertical: 8,
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

/** Cuentas con su saldo, en filas simples como los movimientos; al tocarlas se abre su detalle. */
export function AccountList({ items }: { items: readonly AccountBalance[] }) {
  const styles = useStyles(makeStyles);
  return (
    <View>
      {items.map(({ account, balance, negative }) => (
        <Pressable
          key={account.id}
          role="button"
          accessibilityLabel={`Abrir ${account.name}`}
          onPress={() => router.push(`/accounts/${account.id}`)}
          style={styles.item}
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
              {`${formatMoney(balance, account.currency)} ${account.currency}`}
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
