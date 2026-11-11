import { StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles } from '../../theme';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: 6 },
    label: { ...t.type.caption, fontWeight: '600', color: t.colors.textMuted },
    bar: { flexDirection: 'row', gap: 6 },
    segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceSoft },
    filled: { backgroundColor: t.colors.primary },
  });

/** Avance del onboarding: «Paso 2 de 5» y una barra de cinco tramos (escenario 3.3). */
export function StepProgress({ step, total = 5 }: { step: number; total?: number }) {
  const styles = useStyles(makeStyles);
  return (
    <View
      accessible
      role="progressbar"
      accessibilityLabel={`Paso ${step} de ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step }}
      style={styles.wrap}
    >
      <Text style={styles.label}>{`Paso ${step} de ${total}`}</Text>
      <View style={styles.bar}>
        {Array.from({ length: total }, (_, i) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: los tramos son fijos y no cambian de lugar
            key={i}
            testID={i < step ? 'step-segment-filled' : 'step-segment'}
            style={[styles.segment, i < step ? styles.filled : null]}
          />
        ))}
      </View>
    </View>
  );
}
