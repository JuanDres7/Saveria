import { type ThemeColors, useTheme } from '../theme';
import type { LucideIcon } from './icons';

/**
 * Ícono de línea con el color de un token del tema. Los íconos son decorativos y no se leen en voz
 * alta, salvo que sea el único contenido de un control: entonces se le da una `label`.
 */
export function Icon({
  icon: Glyph,
  size,
  strokeWidth,
  color = 'text',
  label,
  testID,
}: {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  color?: keyof ThemeColors;
  label?: string;
  testID?: string;
}) {
  const theme = useTheme();
  const decorative = label === undefined;
  return (
    <Glyph
      testID={testID}
      size={size ?? theme.icon.row}
      color={theme.colors[color]}
      strokeWidth={strokeWidth ?? theme.icon.stroke}
      {...(decorative
        ? {
            accessibilityElementsHidden: true,
            importantForAccessibility: 'no-hide-descendants' as const,
          }
        : { role: 'img' as const, 'aria-label': label, accessibilityLabel: label })}
    />
  );
}
