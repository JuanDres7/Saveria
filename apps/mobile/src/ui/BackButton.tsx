import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { type Theme, useStyles } from '../theme';
import { Icon } from './Icon';
import { ChevronLeft } from './icons';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    button: {
      width: t.touch,
      height: t.touch,
      borderRadius: t.touch / 2,
      backgroundColor: t.colors.surfaceSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

/** Círculo con una flecha para volver a la pantalla anterior (FR-016). */
export function BackButton({ onPress }: { onPress?: () => void }) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      role="button"
      accessibilityLabel="Volver"
      onPress={onPress ?? (() => router.back())}
      style={styles.button}
    >
      <Icon icon={ChevronLeft} size={22} />
    </Pressable>
  );
}
