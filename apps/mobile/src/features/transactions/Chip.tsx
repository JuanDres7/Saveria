import { Pressable, StyleSheet, Text } from 'react-native';

/** Opción compacta de selección única (tipo, categoría, cuenta, fecha, filtro). */
export function Chip({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      role="radio"
      aria-checked={checked}
      accessibilityLabel={label}
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
    borderColor: '#9ca3af',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipChecked: { borderColor: '#0f766e', backgroundColor: '#0f766e' },
  chipTextChecked: { color: '#ffffff', fontWeight: '600' },
});
