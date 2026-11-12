import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles } from '../../theme';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import type { LucideIcon } from '../../ui/icons';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: { padding: 16, gap: 14 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    icon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: t.colors.sage,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...t.type.subtitle, color: t.colors.text, flexShrink: 1 },
  });

/**
 * Un grupo de opciones de Configuración en una tarjeta con ícono y título. Los grupos nuevos del mapa
 * de la app («Tu plan», «Sincronización») entrarán como grupos, sin reordenar la pantalla.
 */
export function SettingsGroup({
  id,
  title,
  icon,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  const styles = useStyles(makeStyles);
  return (
    <Card testID={`settings-group-${id}`} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Icon icon={icon} color="primary" size={18} testID="settings-group-icon" />
        </View>
        <Text role="heading" style={styles.title}>
          {title}
        </Text>
      </View>
      {children}
    </Card>
  );
}
