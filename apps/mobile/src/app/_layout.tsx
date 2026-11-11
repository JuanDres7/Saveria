import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { registerAccountHandlers } from '../features/accounts/account-service';
import { authService } from '../features/auth/auth-service';
import { bootstrapSession } from '../features/auth/bootstrap';
import { registerProfileConflictHandler } from '../features/profile/profile-service';
import { registerTransactionHandlers } from '../features/transactions/transaction-service';
import { verificationService } from '../features/verification/verification-service';
import { watchOutbox } from '../outbox/user-outbox';
import { routeGroupFor } from '../session/guards';
import { useSession, watchConnectivity } from '../session/session-store';
import { useTheme } from '../theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useSession((s) => s.status);
  const me = useSession((s) => s.me);
  const isOnline = useSession((s) => s.isOnline);
  const { colors } = useTheme();

  // El fondo de la ventana sigue al tema: así no destella en blanco al abrir ni al cambiar de modo.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  useEffect(() => {
    const stopWatching = watchConnectivity();
    // Un cierre de sesión hecho sin conexión se revoca en el servidor cuando vuelve la red.
    const stopRevocation = authService.watchPendingRevocation();
    // Los cambios hechos sin conexión se envían cuando vuelve la red (FR-022).
    const stopOutbox = watchOutbox();
    // Al volver la red se consulta el estado de la cuenta: el bloqueo de verificación solo se
    // muestra cuando el servidor lo confirma (FR-032).
    const stopVerification = verificationService.watchOnReconnect();
    registerProfileConflictHandler();
    registerTransactionHandlers();
    registerAccountHandlers();
    void bootstrapSession();
    void authService.sendPendingRevocation();
    if (__DEV__ && process.env.EXPO_PUBLIC_SMOKE === '1') {
      void import('../dev/smoke').then((smoke) => smoke.runSmoke());
    }
    const seedCount = Number(process.env.EXPO_PUBLIC_SEED_TRANSACTIONS);
    if (__DEV__ && Number.isInteger(seedCount) && seedCount > 0) {
      void import('../dev/seed-transactions').then((seed) => seed.runSeed(seedCount));
    }
    return () => {
      stopWatching();
      stopRevocation();
      stopOutbox();
      stopVerification();
    };
  }, []);

  const group = routeGroupFor({ status, me, isOnline });

  useEffect(() => {
    if (group !== 'splash') void SplashScreen.hideAsync();
  }, [group]);

  // Mientras no se sabe si hay sesión se mantiene la pantalla de carga.
  if (group === 'splash') return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        {/* Siempre disponible: decide a qué zona ir (ver src/app/index.tsx) */}
        <Stack.Screen name="index" />
        <Stack.Protected guard={group === 'auth'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={group === 'onboarding'}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={group === 'app' || group === 'verify-gate'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
