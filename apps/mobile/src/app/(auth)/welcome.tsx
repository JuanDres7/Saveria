import { router } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Body, LinkButton, PrimaryButton } from '../../features/auth/components';
import { useSession } from '../../session/session-store';
import { type Theme, useStyles } from '../../theme';
import { BrandMark } from '../../ui/BrandMark';
import { Veins } from '../../ui/Leaf';
import { ScreenBackground } from '../../ui/ScreenBackground';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    hero: {
      backgroundColor: t.colors.hero,
      borderBottomLeftRadius: t.radius.control,
      paddingHorizontal: 24,
      overflow: 'hidden',
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    brandText: { ...t.type.title, fontSize: 28, color: t.colors.onHero },
    body: { flex: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 12, gap: 12 },
    title: { ...t.type.title, fontSize: 34, color: t.colors.text },
    spacer: { flex: 1 },
  });

// Las nervaduras de la bienvenida: más grandes que las de la tarjeta de balance y pegadas abajo.
const VEINS: ViewStyle = {
  position: 'absolute',
  right: -10,
  bottom: 0,
  width: '86%',
  height: '78%',
};

export default function Welcome() {
  const notice = useSession((s) => s.notice);
  const setNotice = useSession((s) => s.setNotice);
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  // La hoja ocupa media pantalla, como en la maqueta, y deja sitio al texto y a los dos botones
  // (más sitio si la letra del teléfono es grande).
  const room = 360 * Math.min(Math.max(fontScale, 1), 1.5);
  const heroHeight = Math.round(Math.max(240, Math.min(height * 0.52, height - room)));

  return (
    <ScreenBackground edges={['bottom']} blob={false}>
      <View
        testID="welcome-hero"
        style={[
          styles.hero,
          {
            height: heroHeight,
            paddingTop: insets.top + 36,
            borderBottomRightRadius: Math.round(width * 0.55),
          },
        ]}
      >
        <Veins style={VEINS} />
        <View style={styles.brand}>
          <BrandMark size={48} tone="onHero" />
          <Text style={styles.brandText}>Saveria</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text role="heading" style={styles.title}>
          Bienvenido a Saveria
        </Text>
        <Body muted>Cuéntale a Saveria tus gastos e ingresos con tus palabras.</Body>
        {/* Aviso que deja el cierre de sesión (cambios pendientes, FR-010a); se cierra al tocarlo. */}
        {notice ? (
          <Pressable accessibilityHint="Toca para cerrar el aviso" onPress={() => setNotice(null)}>
            <Banner message={notice} />
          </Pressable>
        ) : null}
        <View style={styles.spacer} />
        <PrimaryButton label="Crear cuenta" onPress={() => router.push('/register')} />
        <LinkButton
          label="Ya tengo cuenta"
          underline={false}
          onPress={() => router.push('/login')}
        />
      </View>
    </ScreenBackground>
  );
}
