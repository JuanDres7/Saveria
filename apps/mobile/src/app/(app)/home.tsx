import { formatAmount } from '@saveria/shared';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { authService } from '../../features/auth/auth-service';
import { PrimaryButton, Screen, styles, TextButton } from '../../features/auth/components';
import { refreshLedger, useLedger } from '../../features/transactions/ledger';
import { TransactionRow } from '../../features/transactions/RecentList';
import { VerifyBanner } from '../../features/verification/VerifyBanner';
import { useSession } from '../../session/session-store';

/** Pantalla principal: la cuenta por defecto, los últimos movimientos y el botón para registrar. */
export default function Home() {
  const me = useSession((s) => s.me);
  const accounts = useLedger((s) => s.accounts);
  const balances = useLedger((s) => s.balances);
  const recent = useLedger((s) => s.recent);

  useEffect(() => refreshLedger(), []);
  if (!me) return null;

  // FR-017: sin nombre para la IA, se usa la parte del correo antes de la "@".
  const name = me.profile.aiName ?? me.email.split('@')[0];
  const local = accounts.find((a) => a.isDefault && a.archivedAt === null);
  const account = local ?? me.defaultAccount;
  const balance = account ? (balances[account.id] ?? account.initialBalance) : null;

  return (
    <Screen title={`Hola, ${name}`}>
      <VerifyBanner />
      {account && balance !== null ? (
        <View style={styles.option}>
          <Text style={styles.optionLabel}>{account.name}</Text>
          <Text>{`${formatAmount(balance, account.currency)} ${account.currency}`}</Text>
        </View>
      ) : null}
      {/* FR-008 / FR-015: sin moneda principal no se pueden registrar movimientos. */}
      {me.profile.primaryCurrency ? (
        <PrimaryButton
          label="Registrar movimiento"
          onPress={() => router.push('/transactions/new')}
        />
      ) : null}
      {recent.length > 0 ? (
        <View>
          <Text style={styles.label}>Últimos movimientos</Text>
          {recent.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} accounts={accounts} />
          ))}
        </View>
      ) : null}
      <TextButton label="Configuración" onPress={() => router.push('/settings')} />
      <TextButton label="Cerrar sesión" onPress={() => void authService.logout()} />
    </Screen>
  );
}
