import { StyleSheet, View } from 'react-native';
import { type Theme, type ThemeColors, useStyles, useTheme } from '../theme';
import { type Tone, visualForSlug } from './category-icons';
import { Icon } from './Icon';

type ToneColors = { background: keyof ThemeColors; ink: keyof ThemeColors };

const TONES: Record<Tone, ToneColors> = {
  base: { background: 'sage', ink: 'primary' },
  sand: { background: 'toneSand', ink: 'toneSandInk' },
  mist: { background: 'toneMist', ink: 'toneMistInk' },
  clay: { background: 'toneClay', ink: 'toneClayInk' },
  neutral: { background: 'surfaceSoft', ink: 'textMuted' },
};

const makeStyles = (_theme: Theme) =>
  StyleSheet.create({ circle: { alignItems: 'center', justifyContent: 'center' } });

/** Círculo con el ícono y el tono de una categoría. No se lee: el nombre de la categoría va al lado. */
export function CategoryIcon({
  slug,
  size = 36,
  testID,
  visual: override,
}: {
  slug?: string | null;
  size?: number;
  testID?: string;
  /** Ícono y tono propios (transferencias y ajustes, que no tienen categoría) */
  visual?: ReturnType<typeof visualForSlug>;
}) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { icon, tone } = override ?? visualForSlug(slug);
  const colors = TONES[tone];
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors[colors.background],
        },
      ]}
    >
      <Icon icon={icon} color={colors.ink} size={Math.round(size * 0.5)} />
    </View>
  );
}
