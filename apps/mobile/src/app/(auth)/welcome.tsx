import { router } from 'expo-router';
import { Leaf as LeafIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Body, LinkButton, PrimaryButton } from '../../features/auth/components';
import { useSession } from '../../session/session-store';
import { type Theme, useStyles } from '../../theme';
import { Icon } from '../../ui/Icon';
import { Veins } from '../../ui/Leaf';
import { ScreenBackground } from '../../ui/ScreenBackground';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    hero: {
      height: 300,
      backgroundColor: t.colors.hero,
      borderBottomRightRadius: 150,
      borderBottomLeftRadius: t.radius.control,
      paddingHorizontal: 24,
      overflow: 'hidden',
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    mark: {
      width: 40,
      height: 40,
      backgroundColor: t.colors.onHero,
      borderTopLeftRadius: 16,
      borderBottomRightRadius: 16,
      borderTopRightRadius: 6,
      borderBottomLeftRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandText: { ...t.type.title, fontSize: 24, color: t.colors.onHero },
    body: { flex: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 12, gap: 12 },
    title: { ...t.type.title, fontSize: 29, color: t.colors.text },
    spacer: { flex: 1 },
  });

export default function Welcome() {
  const notice = useSession((s) => s.notice);
  const setNotice = useSession((s) => s.setNotice);
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();

  return (
    <ScreenBackground edges={['bottom']}>
      <View testID="welcome-hero" style={[styles.hero, { paddingTop: insets.top + 28 }]}>
        <Veins />
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Icon icon={LeafIcon} color="hero" size={22} />
          </View>
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
        <LinkButton label="Ya tengo cuenta" onPress={() => router.push('/login')} />
      </View>
    </ScreenBackground>
  );
}
