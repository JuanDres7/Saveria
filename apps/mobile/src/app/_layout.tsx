import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { bootstrapSession } from '../features/auth/bootstrap';
import { routeGroupFor } from '../session/guards';
import { useSession, watchConnectivity } from '../session/session-store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useSession((s) => s.status);
  const me = useSession((s) => s.me);
  const isOnline = useSession((s) => s.isOnline);

  useEffect(() => {
    const stopWatching = watchConnectivity();
    void bootstrapSession();
    if (__DEV__ && process.env.EXPO_PUBLIC_SMOKE === '1') {
      void import('../dev/smoke').then((smoke) => smoke.runSmoke());
    }
    return stopWatching;
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
