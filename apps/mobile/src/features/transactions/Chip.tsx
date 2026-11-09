import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../../theme';

/** Opción compacta de selección única (tipo, categoría, cuenta, fecha, filtro). */
export function Chip({
  label,
  checked,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  checked: boolean;
  onPress(): void;
  /** Si el texto solo no basta (por ejemplo "Hacia Nequi" frente al "Nequi" de origen) */
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      role="radio"
      aria-checked={checked}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={[styles.chip, checked ? styles.chipChecked : null]}
    >
      <Text style={checked ? styles.chipTextChecked : null}>{label}</Text>
    </Pressable>
  );
}

export const chipRow = { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } as const;

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipTextChecked: { color: colors.onPrimary, fontWeight: '600' },
});
