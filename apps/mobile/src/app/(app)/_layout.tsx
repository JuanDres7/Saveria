import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UndoSnackbar } from '../../features/transactions/UndoSnackbar';
import { routeGroupFor } from '../../session/guards';
import { useSession } from '../../session/session-store';
import { useTheme } from '../../theme';
import { AppTabBar, isSectionPath } from '../../ui/AppTabBar';
import { TAB_BAR_HEIGHT, TAB_FAB_OVERHANG } from '../../ui/TabBar';

export default function AppLayout() {
  const status = useSession((s) => s.status);
  const me = useSession((s) => s.me);
  const isOnline = useSession((s) => s.isOnline);
  const group = routeGroupFor({ status, me, isOnline });
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  // La barra solo está en las cuatro secciones, con la app en uso (no en formularios, detalles ni
  // en el bloqueo por correo sin verificar) y deja a los formularios todo el alto (FR-015).
  const showBar = group === 'app' && isSectionPath(pathname);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
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
      </View>
      {showBar ? <AppTabBar /> : null}
      {/* Fuera de las pantallas: sigue visible al volver a la lista tras borrar; por encima de la barra y del «+». */}
      <UndoSnackbar
        bottomOffset={showBar ? TAB_BAR_HEIGHT + insets.bottom + TAB_FAB_OVERHANG + 8 : 24}
      />
    </View>
  );
}
