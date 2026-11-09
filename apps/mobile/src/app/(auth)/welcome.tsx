import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { Banner, PrimaryButton, Screen, styles } from '../../features/auth/components';
import { useSession } from '../../session/session-store';

export default function Welcome() {
  const notice = useSession((s) => s.notice);
  const setNotice = useSession((s) => s.setNotice);

  return (
    <Screen title="Bienvenido a Saveria">
      <Text>Cuéntale a Saveria tus gastos e ingresos con tus palabras.</Text>
      {/* Aviso que deja el cierre de sesión (cambios pendientes, FR-010a); se cierra al tocarlo. */}
      {notice ? (
        <Pressable accessibilityHint="Toca para cerrar el aviso" onPress={() => setNotice(null)}>
          <Banner message={notice} />
        </Pressable>
      ) : null}
      <PrimaryButton label="Crear cuenta" onPress={() => router.push('/register')} />
      <Pressable role="link" onPress={() => router.push('/login')}>
        <Text style={styles.link}>Ya tengo cuenta</Text>
      </Pressable>
    </Screen>
  );
}
