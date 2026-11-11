import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { selectBalanceCard } from '../../features/accounts/balance-card';
import { type HomeContext, visibleBlocks } from '../../features/home/blocks';
import {
  groupByDay,
  refreshLedger,
  summarizeAccounts,
  useLedger,
} from '../../features/transactions/ledger';
import { useSession } from '../../session/session-store';
import { type Theme, useStyles } from '../../theme';
import { ScreenBackground } from '../../ui/ScreenBackground';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    scroll: { flexGrow: 1 },
    top: { gap: 14, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18 },
    sheet: {
      flex: 1,
      gap: 18,
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: t.radius.sheet,
      borderTopRightRadius: t.radius.sheet,
      paddingHorizontal: 16,
      paddingTop: 18,
      // El botón «+» de la barra sobresale: deja sitio para que no tape el final de la lista.
      paddingBottom: 40,
    },
  });

/** Pantalla principal: saludo, balance, cuentas y últimos movimientos, en los bloques del mapa de la app. */
export default function Home() {
  const me = useSession((s) => s.me);
  const accounts = useLedger((s) => s.accounts);
  const balances = useLedger((s) => s.balances);
  const recent = useLedger((s) => s.recent);
  const styles = useStyles(makeStyles);

  useEffect(() => refreshLedger(), []);
  if (!me) return null;

  // FR-017: sin nombre para la IA, se usa la parte del correo antes de la "@".
  const name = me.profile.aiName ?? me.email.split('@')[0] ?? '';
  const primary = me.profile.primaryCurrency;
  const summary = summarizeAccounts(accounts, balances, primary);
  // Recién terminado el onboarding, la base local puede no tener todavía «Efectivo»: se dibuja la del perfil.
  const tiles =
    summary.active.length === 0 && me.defaultAccount
      ? [{ account: me.defaultAccount, balance: me.defaultAccount.initialBalance, negative: false }]
      : summary.active;
  const ctx: HomeContext = {
    name,
    emailVerified: me.emailVerified,
    hasPrimaryCurrency: Boolean(primary),
    card: selectBalanceCard(summary, primary, me.defaultAccount),
    tiles,
    activeCount: summary.active.length,
    accounts,
    sections: groupByDay(recent),
  };

  return (
    <ScreenBackground edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.top}>
          {visibleBlocks(ctx, 'top').map(({ key, node }) => (
            <View key={key} testID={key.startsWith('home-block-') ? key : undefined}>
              {node}
            </View>
          ))}
        </View>
        <View style={styles.sheet}>
          {visibleBlocks(ctx, 'sheet').map(({ key, node }) => (
            <View key={key} testID={key.startsWith('home-block-') ? key : undefined}>
              {node}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
