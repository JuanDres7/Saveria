import { View } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Leaf as LeafIcon } from './icons';

/**
 * La marca de Saveria: una hoja dentro de la forma de hoja. `primary` va sobre el fondo de la app
 * (Inicio) y `onHero` sobre el verde de la bienvenida. Es adorno: no se lee.
 */
export function BrandMark({
  size = 44,
  tone = 'primary',
}: {
  size?: number;
  tone?: 'primary' | 'onHero';
}) {
  const { colors } = useTheme();
  const big = Math.round(size * 0.42);
  const small = Math.round(size * 0.16);
  return (
    <View
      testID="brand-mark"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        backgroundColor: tone === 'primary' ? colors.primary : colors.onHero,
        borderTopLeftRadius: big,
        borderBottomRightRadius: big,
        borderTopRightRadius: small,
        borderBottomLeftRadius: small,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon
        icon={LeafIcon}
        color={tone === 'primary' ? 'onPrimary' : 'hero'}
        size={Math.round(size * 0.52)}
      />
    </View>
  );
}
