import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AccountList } from '../../../features/accounts/AccountList';
import { TextButton } from '../../../features/auth/components';
import { refreshLedger, summarizeAccounts, useLedger } from '../../../features/transactions/ledger';
import { useSession } from '../../../session/session-store';
import { type Theme, useStyles } from '../../../theme';
import { ScreenBackground } from '../../../ui/ScreenBackground';
import { SectionHeader } from '../../../ui/SectionHeader';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    scroll: { flexGrow: 1 },
    top: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 18 },
    title: { ...t.type.title, color: t.colors.text },
    sheet: {
      flex: 1,
      gap: 4,
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: t.radius.sheet,
      borderTopRightRadius: t.radius.sheet,
      paddingHorizontal: 16,
      paddingTop: 12,
      // El botón «+» de la barra sobresale: deja sitio para que no tape el final de la lista.
      paddingBottom: 40,
    },
  });

/**
 * Cuentas de dinero activas con su saldo (historia 3). Es una sección de la barra inferior: el título
 * arriba y una sola lámina con las cuentas en filas. «Metas» y «Deudas» entrarán como partes nuevas
 * de la lámina (docs/mapa-de-la-app.md).
 */
export default function Accounts() {
  const primary = useSession((s) => s.me?.profile.primaryCurrency) ?? null;
  const accounts = useLedger((s) => s.accounts);
  const balances = useLedger((s) => s.balances);
  const styles = useStyles(makeStyles);
  useEffect(() => refreshLedger(), []);

  const { active } = summarizeAccounts(accounts, balances, primary);

  return (
    <ScreenBackground edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.top}>
          <Text role="heading" style={styles.title}>
            Cuentas
          </Text>
        </View>
        <View testID="accounts-sheet" style={styles.sheet}>
          <SectionHeader
            title="Tus cuentas"
            action={{
              label: 'Nueva',
              accessibilityLabel: 'Nueva cuenta',
              onPress: () => router.push('/accounts/new'),
            }}
          />
          <AccountList items={active} />
          <TextButton
            label="Cuentas archivadas"
            onPress={() => router.push('/accounts/archived')}
          />
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
