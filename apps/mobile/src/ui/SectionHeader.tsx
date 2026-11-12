import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles } from '../theme';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: { ...t.type.subtitle, color: t.colors.text, flexShrink: 1 },
    action: { minHeight: 36, justifyContent: 'center', paddingLeft: 12 },
    actionText: { ...t.type.caption, fontSize: 14, fontWeight: '600', color: t.colors.primary },
  });

// El vínculo mide 36 dp de alto; esta zona extra suma el área de toque a 48 dp (SC-003).
const HIT_SLOP = { top: 6, bottom: 6, left: 8, right: 8 } as const;

export interface SectionAction {
  /** Texto corto que se ve («Ver todo», «Nueva») */
  label: string;
  /** Nombre completo para quien no ve el título de al lado («Nueva cuenta») */
  accessibilityLabel?: string;
  onPress(): void;
}

/** Título de un bloque y, a su derecha, un vínculo corto opcional. */
export function SectionHeader({ title, action }: { title: string; action?: SectionAction }) {
  const styles = useStyles(makeStyles);
  return (
    <View testID="section-header" style={styles.row}>
      <Text role="heading" style={styles.title}>
        {title}
      </Text>
      {action ? (
        <Pressable
          role="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          hitSlop={HIT_SLOP}
          onPress={action.onPress}
          style={styles.action}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
