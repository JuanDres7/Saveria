import { Text, View } from 'react-native';
import { authService } from '../../features/auth/auth-service';
import { PrimaryButton } from '../../features/auth/components';

// Marcador: la pantalla principal real llega con la historia 2 (onboarding).
export default function Home() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text>Saveria</Text>
      <PrimaryButton label="Cerrar sesión" onPress={() => void authService.logout()} />
    </View>
  );
}
