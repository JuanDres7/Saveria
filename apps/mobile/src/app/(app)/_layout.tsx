import { Stack } from 'expo-router';
import { View } from 'react-native';
import { UndoSnackbar } from '../../features/transactions/UndoSnackbar';
import { routeGroupFor } from '../../session/guards';
import { useSession } from '../../session/session-store';

export default function AppLayout() {
  const status = useSession((s) => s.status);
  const me = useSession((s) => s.me);
  const isOnline = useSession((s) => s.isOnline);
  const group = routeGroupFor({ status, me, isOnline });

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={group === 'app'}>
          <Stack.Screen name="home" />
          <Stack.Screen name="transactions/new" />
          <Stack.Screen name="transactions/index" />
          <Stack.Screen name="transactions/[id]" />
          <Stack.Screen name="transfer" />
          <Stack.Screen name="accounts/index" />
          <Stack.Screen name="accounts/new" />
          <Stack.Screen name="accounts/archived" />
          <Stack.Screen name="accounts/[id]" />
          <Stack.Screen name="accounts/[id]/adjust" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="settings/change-password" />
          <Stack.Screen name="settings/delete-account" />
        </Stack.Protected>
        <Stack.Protected guard={group === 'verify-gate'}>
          <Stack.Screen name="verify-email-gate" />
        </Stack.Protected>
      </Stack>
      {/* Fuera de las pantallas: sigue visible al volver a la lista tras borrar. */}
      <UndoSnackbar />
    </View>
  );
}
