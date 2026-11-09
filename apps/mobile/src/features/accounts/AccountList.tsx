import { formatAmount } from '@saveria/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../theme';
import { styles as base } from '../auth/components';
import type { AccountBalance } from '../transactions/ledger';
import { NEGATIVE_COLOR } from '../transactions/RecentList';

/** Tarjetas de cuentas con su saldo; al tocarlas se abre el detalle de la cuenta. */
export function AccountList({ items }: { items: readonly AccountBalance[] }) {
  return (
    <>
      {items.map(({ account, balance, negative }) => (
        <Pressable
          key={account.id}
          role="button"
          accessibilityLabel={`Abrir ${account.name}`}
          onPress={() => router.push(`/accounts/${account.id}`)}
          style={base.option}
        >
          <Text style={base.optionLabel}>{account.name}</Text>
          <Text style={negative ? styles.negative : null}>
            {`${formatAmount(balance, account.currency)} ${account.currency}`}
          </Text>
          {account.isDefault ? <Text style={styles.hint}>Cuenta por defecto</Text> : null}
          {account.syncState === 'rejected' ? (
            <Text style={base.error}>{`No se pudo guardar: ${account.syncError ?? ''}`}</Text>
          ) : null}
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  negative: { color: NEGATIVE_COLOR, fontWeight: '600' },
  hint: { color: colors.primary, fontSize: 13 },
});
