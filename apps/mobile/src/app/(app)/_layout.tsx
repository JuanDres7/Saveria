import { Stack } from 'expo-router';
import { routeGroupFor } from '../../session/guards';
import { useSession } from '../../session/session-store';

export default function AppLayout() {
  const status = useSession((s) => s.status);
  const me = useSession((s) => s.me);
  const isOnline = useSession((s) => s.isOnline);
  const group = routeGroupFor({ status, me, isOnline });

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={group === 'app'}>
        <Stack.Screen name="home" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/change-password" />
      </Stack.Protected>
      <Stack.Protected guard={group === 'verify-gate'}>
        <Stack.Screen name="verify-email-gate" />
      </Stack.Protected>
    </Stack>
  );
}
