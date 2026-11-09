import { formatAmount } from '@saveria/shared';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { authService } from '../../features/auth/auth-service';
import { styles as base, PrimaryButton, TextButton } from '../../features/auth/components';
import {
  groupByDay,
  refreshLedger,
  summarizeAccounts,
  useLedger,
} from '../../features/transactions/ledger';
import { DaySections, NEGATIVE_COLOR } from '../../features/transactions/RecentList';
import { VerifyBanner } from '../../features/verification/VerifyBanner';
import { useSession } from '../../session/session-store';

/** Pantalla principal: saldos de las cuentas, total, últimos movimientos y registrar. */
export default function Home() {
  const me = useSession((s) => s.me);
  const accounts = useLedger((s) => s.accounts);
  const balances = useLedger((s) => s.balances);
  const recent = useLedger((s) => s.recent);

  useEffect(() => refreshLedger(), []);
  if (!me) return null;

  // FR-017: sin nombre para la IA, se usa la parte del correo antes de la "@".
  const name = me.profile.aiName ?? me.email.split('@')[0];
  const primary = me.profile.primaryCurrency;
  const summary = summarizeAccounts(accounts, balances, primary);
  // Recién terminado el onboarding, la base local puede no tener todavía "Efectivo".
  const fallback =
    summary.active.length === 0 && me.defaultAccount
      ? [{ account: me.defaultAccount, balance: me.defaultAccount.initialBalance, negative: false }]
      : [];
  const cards = summary.active.length > 0 ? summary.active : fallback;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text role="heading" style={base.title}>{`Hola, ${name}`}</Text>
      <VerifyBanner />

      {cards.map(({ account, balance, negative }) => (
        <View key={account.id} style={base.option} accessibilityLabel={`Saldo de ${account.name}`}>
          <Text style={base.optionLabel}>{account.name}</Text>
          {/* Cada saldo en la moneda de su cuenta (FR-012); negativo, en rojo (FR-014). */}
          <Text style={negative ? styles.negative : null}>
            {`${formatAmount(balance, account.currency)} ${account.currency}`}
          </Text>
        </View>
      ))}
      {summary.total !== null && primary ? (
        <Text style={base.optionLabel}>
          {`Total: ${formatAmount(summary.total, primary)} ${primary}`}
        </Text>
      ) : null}

      {/* FR-008 / FR-015: sin moneda principal no se pueden registrar movimientos. */}
      {primary ? (
        <PrimaryButton
          label="Registrar movimiento"
          onPress={() => router.push('/transactions/new')}
        />
      ) : null}

      {recent.length > 0 ? (
        <View>
          <Text style={base.label}>Últimos movimientos</Text>
          <DaySections sections={groupByDay(recent)} accounts={accounts} />
          <TextButton label="Ver todo" onPress={() => router.push('/transactions')} />
        </View>
      ) : null}

      <TextButton label="Cuentas de dinero" onPress={() => router.push('/accounts')} />
      <TextButton label="Configuración" onPress={() => router.push('/settings')} />
      <TextButton label="Cerrar sesión" onPress={() => void authService.logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 48, gap: 16 },
  negative: { color: NEGATIVE_COLOR, fontWeight: '600' },
});
