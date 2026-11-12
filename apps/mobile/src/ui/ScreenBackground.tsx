import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { type Theme, useStyles, useTheme } from '../theme';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background, overflow: 'hidden' },
    blob: { position: 'absolute', top: -70, right: -96, width: 250, height: 210 },
  });

/**
 * Fondo de pantalla: el color del tema y una forma orgánica suave en la esquina superior. El
 * contenido queda dentro de los márgenes del sistema (muesca, barra de estado, barra de gestos);
 * una pantalla con barra inferior pasa `edges={['top']}` porque la barra suma su propio margen.
 */
export function ScreenBackground({
  children,
  edges = ['top', 'bottom'],
  style,
  testID = 'screen-background',
}: {
  children?: ReactNode;
  edges?: ('top' | 'bottom')[];
  style?: ViewStyle;
  testID?: string;
}) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <View
      testID={testID}
      style={[
        styles.screen,
        {
          paddingTop: edges.includes('top') ? insets.top : 0,
          paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        },
        style,
      ]}
    >
      <View
        testID="screen-blob"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.blob}
      >
        <Svg width="100%" height="100%" viewBox="0 0 250 210">
          <Path
            d="M40 22 C120 -22 232 10 250 92 C264 152 200 204 130 196 C58 188 -12 122 40 22 Z"
            fill={theme.colors.sage}
            opacity={theme.scheme === 'dark' ? 0.55 : 0.75}
          />
        </Svg>
      </View>
      {children}
    </View>
  );
}
