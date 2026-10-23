import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { authService } from '../features/auth/auth-service';
import { bootstrapSession } from '../features/auth/bootstrap';
import { registerProfileConflictHandler } from '../features/profile/profile-service';
import { watchOutbox } from '../outbox/user-outbox';
import { routeGroupFor } from '../session/guards';
import { useSession, watchConnectivity } from '../session/session-store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useSession((s) => s.status);
  const me = useSession((s) => s.me);
  const isOnline = useSession((s) => s.isOnline);

  useEffect(() => {
    const stopWatching = watchConnectivity();
    // Un cierre de sesión hecho sin conexión se revoca en el servidor cuando vuelve la red.
    const stopRevocation = authService.watchPendingRevocation();
    // Los cambios hechos sin conexión se envían cuando vuelve la red (FR-022).
    const stopOutbox = watchOutbox();
    registerProfileConflictHandler();
    void bootstrapSession();
    void authService.sendPendingRevocation();
    if (__DEV__ && process.env.EXPO_PUBLIC_SMOKE === '1') {
      void import('../dev/smoke').then((smoke) => smoke.runSmoke());
    }
    return () => {
      stopWatching();
      stopRevocation();
      stopOutbox();
    };
  }, []);

  const group = routeGroupFor({ status, me, isOnline });

  useEffect(() => {
    if (group !== 'splash') void SplashScreen.hideAsync();
  }, [group]);

  // Mientras no se sabe si hay sesión se mantiene la pantalla de carga.
  if (group === 'splash') return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
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
  );
}
