import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { type Theme, useStyles, useTheme } from '../theme';

/**
 * Nervaduras de la hoja (FR-031): una forma suave y unas líneas finas, dibujadas una sola vez y sin
 * animación. Son solo adorno: no entran en el orden de foco ni se leen.
 */
function Veins({ shape, line }: { shape: string; line: string }) {
  return (
    <View
      testID="leaf-veins"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={veinStyle}
    >
      <Svg width="100%" height="100%" viewBox="0 0 200 140" preserveAspectRatio="none">
        <Path d="M210 -10 C120 0 70 60 86 150 L210 150 Z" fill={shape} />
        <Path
          d="M204 -4 C150 34 118 86 104 150 M168 30 C150 34 132 34 118 28 M146 62 C128 70 110 70 96 64 M190 44 C184 62 172 78 156 88 M176 84 C170 100 158 114 144 122"
          fill="none"
          stroke={line}
          strokeWidth={1.6}
          strokeLinecap="round"
          opacity={0.75}
        />
      </Svg>
    </View>
  );
}

const veinStyle: ViewStyle = { position: 'absolute', right: 0, top: 0, bottom: 0, width: '62%' };

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    balance: {
      backgroundColor: t.colors.hero,
      borderTopLeftRadius: t.radius.leaf,
      borderBottomRightRadius: t.radius.leaf,
      borderTopRightRadius: t.radius.leafSmall,
      borderBottomLeftRadius: t.radius.leafSmall,
      overflow: 'hidden',
      ...t.shadow.hero,
    },
    fab: {
      backgroundColor: t.colors.primary,
      borderTopLeftRadius: t.radius.fab,
      borderBottomRightRadius: t.radius.fab,
      borderTopRightRadius: t.radius.fabSmall,
      borderBottomLeftRadius: t.radius.fabSmall,
      alignItems: 'center',
      justifyContent: 'center',
      ...t.shadow.fab,
    },
  });

/**
 * La forma de hoja de la marca: dos esquinas opuestas muy redondeadas y las otras dos casi rectas.
 * `balance` es la tarjeta de balance (con nervaduras); `fab` es el botón «+» de la barra.
 */
export function Leaf({
  variant,
  children,
  style,
  testID,
}: {
  variant: 'balance' | 'fab';
  children?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View testID={testID} style={[styles[variant], style]}>
      {variant === 'balance' ? (
        <Veins shape={theme.colors.heroShape} line={theme.colors.hero} />
      ) : null}
      {children}
    </View>
  );
}
