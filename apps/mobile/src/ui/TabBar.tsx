import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Theme, useStyles } from '../theme';
import { Icon } from './Icon';
import { House, type LucideIcon, Plus, ReceiptText, Settings, Wallet } from './icons';
import { Leaf } from './Leaf';

/** Una sección de la barra. `badge` dibuja un punto de aviso (hoy sin uso, docs/mapa-de-la-app.md). */
export interface TabItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: boolean;
}

/**
 * Las secciones de la barra, en orden. Agregar o cambiar una es tocar esta lista, no el componente
 * (FR-032: Saveria y «Mi plata» entrarán después en su lugar del mapa de la app).
 */
export const TAB_ITEMS: readonly TabItem[] = [
  { key: 'home', label: 'Inicio', icon: House, path: '/home' },
  { key: 'transactions', label: 'Movimientos', icon: ReceiptText, path: '/transactions' },
  { key: 'accounts', label: 'Cuentas', icon: Wallet, path: '/accounts' },
  { key: 'settings', label: 'Ajustes', icon: Settings, path: '/settings' },
];

/** Alto de la barra sin el margen inferior del sistema. */
export const TAB_BAR_HEIGHT = 64;
/** Lo que el botón «+» sobresale por encima de la barra. */
export const TAB_FAB_OVERHANG = 22;

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: t.colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.divider,
      paddingTop: 6,
      paddingHorizontal: 4,
      minHeight: TAB_BAR_HEIGHT,
    },
    tab: {
      flex: 1,
      minHeight: t.touch,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
    },
    pill: {
      width: 48,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillActive: { backgroundColor: t.colors.sage },
    label: { fontSize: 11, fontWeight: '500', color: t.colors.textMuted },
    labelActive: { fontWeight: '700', color: t.colors.primary },
    badge: {
      position: 'absolute',
      top: 0,
      right: 8,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: t.colors.negative,
      borderWidth: 2,
      borderColor: t.colors.surface,
    },
    center: { width: 64, alignItems: 'center' },
    fab: {
      width: 48,
      height: 48,
      marginTop: -TAB_FAB_OVERHANG,
      borderWidth: 3,
      borderColor: t.colors.surface,
    },
  });

// El botón «+» mide 48 dp; esta zona extra facilita tocarlo sin tapar a sus vecinos.
const FAB_HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 } as const;

/**
 * Barra inferior: las secciones de `items` a los lados y, al centro, el botón «+» que abre «Registrar
 * movimiento» (solo si `showRegister`). Es solo presentación: quien la usa decide a dónde va cada toque.
 */
export function TabBar({
  items = TAB_ITEMS,
  activePath,
  showRegister,
  onSelect,
  onRegister,
}: {
  items?: readonly TabItem[];
  activePath: string;
  showRegister: boolean;
  onSelect(path: string): void;
  onRegister(): void;
}) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const half = Math.ceil(items.length / 2);

  const tab = (item: TabItem) => {
    const active = item.path === activePath;
    return (
      <Pressable
        key={item.key}
        role="tab"
        aria-selected={active}
        accessibilityLabel={item.label}
        onPress={() => {
          if (!active) onSelect(item.path);
        }}
        style={styles.tab}
      >
        <View
          testID={`tab-pill-${item.path}`}
          style={[styles.pill, active ? styles.pillActive : null]}
        >
          <Icon icon={item.icon} size={22} color={active ? 'primary' : 'textMuted'} />
          {item.badge ? <View testID="tab-badge" style={styles.badge} /> : null}
        </View>
        {/* Con letra grande el nombre se achica para caber en una línea, sin partirse ni cortarse. */}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[styles.label, active ? styles.labelActive : null]}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View testID="tab-bar" style={[styles.bar, { paddingBottom: insets.bottom + 6 }]}>
      {items.slice(0, half).map(tab)}
      <View style={styles.center}>
        {showRegister ? (
          <Pressable
            role="button"
            accessibilityLabel="Registrar movimiento"
            hitSlop={FAB_HIT_SLOP}
            onPress={onRegister}
          >
            <Leaf variant="fab" testID="tab-register" style={styles.fab}>
              <Icon icon={Plus} size={23} color="onPrimary" strokeWidth={2} />
            </Leaf>
          </Pressable>
        ) : null}
      </View>
      {items.slice(half).map(tab)}
    </View>
  );
}
