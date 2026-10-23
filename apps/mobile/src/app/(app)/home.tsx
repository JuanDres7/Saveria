import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { authService } from '../../features/auth/auth-service';
import { PrimaryButton, Screen, styles, TextButton } from '../../features/auth/components';
import { useSession } from '../../session/session-store';

/** Pantalla principal provisional: la real llega con las features de movimientos. */
export default function Home() {
  const me = useSession((s) => s.me);
  const [comingSoon, setComingSoon] = useState(false);
  if (!me) return null;

  // FR-017: sin nombre para la IA, se usa la parte del correo antes de la "@".
  const name = me.profile.aiName ?? me.email.split('@')[0];
  const account = me.defaultAccount;

  return (
    <Screen title={`Hola, ${name}`}>
      {account ? (
        <View style={styles.option}>
          <Text style={styles.optionLabel}>{account.name}</Text>
          <Text>{`${account.initialBalance} ${account.currency}`}</Text>
        </View>
      ) : null}
      {/* FR-015: sin moneda principal no se pueden registrar movimientos. */}
      {me.profile.primaryCurrency ? (
        <PrimaryButton label="Registrar movimiento" onPress={() => setComingSoon(true)} />
      ) : null}
      {comingSoon ? <Text>Registrar movimientos llega en la próxima versión.</Text> : null}
      <TextButton label="Configuración" onPress={() => router.push('/settings')} />
      <TextButton label="Cerrar sesión" onPress={() => void authService.logout()} />
    </Screen>
  );
}
