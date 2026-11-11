import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { type Theme, useStyles } from '../../theme';
import { Icon } from '../../ui/Icon';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    chip: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surfaceSoft,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    chipChecked: { backgroundColor: t.colors.primary },
    text: { ...t.type.body, fontSize: 14, fontWeight: '500', color: t.colors.text, flexShrink: 1 },
    textChecked: { color: t.colors.onPrimary, fontWeight: '600' },
  });

// El chip mide 34 dp de alto; esta zona extra suma el área de toque a 48 dp (SC-003).
const HIT_SLOP = { top: 7, bottom: 7 } as const;

/** Opción compacta de selección única (tipo, categoría, cuenta, fecha, filtro). */
export function Chip({
  label,
  checked,
  onPress,
  accessibilityLabel,
  icon,
}: {
  label: string;
  checked: boolean;
  onPress(): void;
  /** Si el texto solo no basta (por ejemplo "Hacia Nequi" frente al "Nequi" de origen) */
  accessibilityLabel?: string;
  /** Ícono de línea a la izquierda del texto (por ejemplo, el de una categoría) */
  icon?: LucideIcon;
}) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      role="radio"
      aria-checked={checked}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      style={[styles.chip, checked ? styles.chipChecked : null]}
    >
      {icon ? <Icon icon={icon} size={16} color={checked ? 'onPrimary' : 'text'} /> : null}
      <Text style={[styles.text, checked ? styles.textChecked : null]}>{label}</Text>
    </Pressable>
  );
}

export const chipRow = { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } as const;
