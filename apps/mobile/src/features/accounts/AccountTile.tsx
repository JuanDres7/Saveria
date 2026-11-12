import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles } from '../../theme';
import { Icon } from '../../ui/Icon';
import { Banknote, Landmark, type LucideIcon, Smartphone } from '../../ui/icons';
import { formatMoney } from '../../ui/money';

/** Lo mínimo que una cuenta necesita para dibujarse: sirve la de la base local y la del perfil. */
export interface AccountTileItem {
  account: { id: string; name: string; type?: string; currency: string };
  /** Texto decimal */
  balance: string;
  negative: boolean;
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  cash: Banknote,
  wallet: Smartphone,
  bank: Landmark,
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: { gap: 8, paddingRight: 16 },
    tile: {
      minWidth: 124,
      maxWidth: 188,
      gap: 6,
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surfaceSoft,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { ...t.type.caption, fontWeight: '500', color: t.colors.textMuted, flexShrink: 1 },
    balance: { ...t.type.amount, color: t.colors.text },
    negative: { color: t.colors.negative, fontWeight: '600' },
  });

/**
 * Una cuenta con su saldo en su propia moneda. El saldo negativo va en rojo y con su signo (FR-008).
 * El nombre accesible es «Saldo de {nombre}», como antes del rediseño.
 */
export function AccountTile({ item }: { item: AccountTileItem }) {
  const styles = useStyles(makeStyles);
  const { account, balance, negative } = item;
  return (
    <View accessibilityLabel={`Saldo de ${account.name}`} testID="account-tile" style={styles.tile}>
      <View style={styles.head}>
        <Icon icon={TYPE_ICONS[account.type ?? 'cash'] ?? Banknote} size={15} color="textMuted" />
        <Text numberOfLines={1} style={styles.name}>
          {account.name}
        </Text>
      </View>
      {/* Con letra grande el saldo se achica para verse completo, nunca se corta con «…». */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[styles.balance, negative ? styles.negative : null]}
      >
        {`${formatMoney(balance, account.currency)} ${account.currency}`}
      </Text>
    </View>
  );
}

/** Las cuentas en una fila que se desliza de lado: con tres o con veinte mide lo mismo. */
export function AccountsRow({ items }: { items: readonly AccountTileItem[] }) {
  const styles = useStyles(makeStyles);
  return (
    <ScrollView
      horizontal
      testID="accounts-row"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((item) => (
        <AccountTile key={item.account.id} item={item} />
      ))}
    </ScrollView>
  );
}
