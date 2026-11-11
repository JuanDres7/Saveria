import { Check, CircleAlert, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors, radius, type Theme, useStyles, useTheme } from '../../theme';
import { Icon } from '../../ui/Icon';
import { ScreenBackground } from '../../ui/ScreenBackground';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
    title: { ...t.type.title, color: t.colors.text },
    field: { gap: 4 },
    label: { ...t.type.bodyStrong, fontSize: 14, color: t.colors.text },
    input: {
      minHeight: t.touch,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surface,
      color: t.colors.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
    },
    inputError: { borderColor: t.colors.negative },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    error: { ...t.type.caption, color: t.colors.negative, flexShrink: 1 },
    button: {
      width: '100%',
      minHeight: t.touch,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    buttonDisabled: { backgroundColor: t.colors.disabled },
    buttonText: { ...t.type.bodyStrong, fontSize: 16, color: t.colors.onPrimary },
    link: {
      minHeight: t.touch,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    linkText: { ...t.type.bodyStrong, color: t.colors.primary },
    option: {
      minHeight: t.touch,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surface,
      padding: 12,
    },
    optionChecked: {
      borderColor: t.colors.primary,
      borderWidth: 2,
      backgroundColor: t.colors.sage,
    },
    optionBody: { flex: 1, gap: 4 },
    optionLabel: { ...t.type.bodyStrong, fontSize: 16, color: t.colors.text },
    optionDescription: { ...t.type.caption, color: t.colors.textMuted },
    banner: {
      backgroundColor: t.colors.warningBackground,
      borderRadius: t.radius.control,
      padding: 12,
    },
    bannerText: { ...t.type.body, color: t.colors.warningText },
  });

/** Mensaje de error junto a un campo: ícono y texto, no solo color (FR-026). */
export function FieldError({ message }: { message: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.errorRow}>
      <Icon icon={CircleAlert} size={16} color="negative" testID="field-error-icon" />
      <Text style={styles.error}>{message}</Text>
    </View>
  );
}

/** Campo de texto con etiqueta y error; la etiqueta también es su nombre accesible. */
export function Field({
  label,
  error,
  ...input
}: { label: string; error?: string } & Omit<TextInputProps, 'accessibilityLabel'>) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={theme.colors.textMuted}
        cursorColor={theme.colors.primary}
        selectionColor={theme.colors.primary}
        style={[styles.input, error ? styles.inputError : null]}
        {...input}
      />
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

/** Botón principal: ancho, de verde de acción y, cuando corresponde, con un ícono. */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled ? styles.buttonDisabled : null]}
    >
      {icon ? <Icon icon={icon} color="onPrimary" size={20} /> : null}
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/** Pantalla de acceso, registro y onboarding: fondo de la marca, título y contenido. */
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <ScreenBackground>
      <View style={styles.screen}>
        <Text role="heading" style={styles.title}>
          {title}
        </Text>
        {children}
      </View>
    </ScreenBackground>
  );
}

/** Opción de una lista: selección única (`radio`) o casilla (`checkbox`). */
export function RadioOption({
  label,
  description,
  checked,
  onPress,
  role = 'radio',
}: {
  label: string;
  description?: string;
  checked: boolean;
  onPress(): void;
  role?: 'radio' | 'checkbox';
}) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      role={role}
      aria-checked={checked}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.option, checked ? styles.optionChecked : null]}
    >
      <View style={styles.optionBody}>
        <Text style={styles.optionLabel}>{label}</Text>
        {description ? <Text style={styles.optionDescription}>{description}</Text> : null}
      </View>
      {checked ? <Icon icon={Check} color="primary" size={20} testID="option-check" /> : null}
    </Pressable>
  );
}

/** Botón secundario (por ejemplo, "Saltar"). */
export function TextButton({ label, onPress }: { label: string; onPress(): void }) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable role="button" accessibilityLabel={label} onPress={onPress} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

export function Banner({ message }: { message: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View testID="banner" style={styles.banner}>
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

/**
 * @deprecated Estilos de antes del rediseño, fijos en la paleta clara, para las pantallas que aún no
 * usan `useStyles()`. Cada pantalla se migra en su historia y esto se retira en la tarea T061.
 */
export const styles = StyleSheet.create({
  field: { gap: 4 },
  title: { fontSize: 26, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600' },
  error: { color: colors.negative, fontSize: 13 },
  link: { color: colors.primary, textDecorationLine: 'underline' },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 4,
  },
  optionLabel: { fontSize: 16, fontWeight: '600' },
  banner: { backgroundColor: colors.warningBackground, borderRadius: radius.md, padding: 12 },
  bannerText: { color: colors.warningText },
});
