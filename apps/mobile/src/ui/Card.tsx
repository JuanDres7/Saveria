import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { type Theme, useStyles } from '../theme';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    surface: { backgroundColor: t.colors.surface, borderRadius: t.radius.card },
    soft: { backgroundColor: t.colors.surfaceSoft, borderRadius: t.radius.card },
  });

/** Tarjeta plana y redondeada, sin sombra (las únicas sombras son la del balance y la del «+»). */
export function Card({
  children,
  tone = 'surface',
  style,
  testID,
}: {
  children?: ReactNode;
  tone?: 'surface' | 'soft';
  style?: ViewStyle;
  testID?: string;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View testID={testID} style={[styles[tone], style]}>
      {children}
    </View>
  );
}
