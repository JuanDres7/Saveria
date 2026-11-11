import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles } from '../theme';
import { BackButton } from './BackButton';
import { ScreenBackground } from './ScreenBackground';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    content: { padding: 16, paddingBottom: 40, gap: 14 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sectionTitle: { ...t.type.title, color: t.colors.text, paddingTop: 4 },
    pageTitle: { ...t.type.subtitle, fontSize: 20, color: t.colors.text, flexShrink: 1 },
  });

/**
 * Pantalla que se desplaza: fondo de la marca y título. Con `back` es una pantalla de detalle o de
 * formulario (botón «Volver» y título pequeño, margen inferior del sistema); sin `back` es una
 * sección de la barra inferior (título grande; la barra pone el margen de abajo).
 */
export function Page({
  title,
  back = false,
  children,
}: {
  title: string;
  back?: boolean;
  children: ReactNode;
}) {
  const styles = useStyles(makeStyles);
  return (
    <ScreenBackground edges={back ? ['top', 'bottom'] : ['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {back ? (
          <View style={styles.header}>
            <BackButton />
            <Text role="heading" style={styles.pageTitle}>
              {title}
            </Text>
          </View>
        ) : (
          <Text role="heading" style={styles.sectionTitle}>
            {title}
          </Text>
        )}
        {children}
      </ScrollView>
    </ScreenBackground>
  );
}
