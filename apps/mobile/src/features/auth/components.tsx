import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors, radius } from '../../theme';

/** Campo de texto con etiqueta y error; la etiqueta también es su nombre accesible. */
export function Field({
  label,
  error,
  ...input
}: { label: string; error?: string } & Omit<TextInputProps, 'accessibilityLabel'>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, error ? styles.inputError : null]}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled ? styles.buttonDisabled : null]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.screen}>
      <Text role="heading" style={styles.title}>
        {title}
      </Text>
      {children}
    </View>
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
  return (
    <Pressable
      role={role}
      aria-checked={checked}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.option, checked ? styles.optionChecked : null]}
    >
      <Text style={styles.optionLabel}>{label}</Text>
      {description ? <Text>{description}</Text> : null}
    </Pressable>
  );
}

/** Botón secundario (por ejemplo, "Saltar"). */
export function TextButton({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable role="button" accessibilityLabel={label} onPress={onPress}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

export function Banner({ message }: { message: string }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  field: { gap: 4 },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 16,
  },
  inputError: { borderColor: colors.negative },
  error: { color: colors.negative, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: colors.disabled },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  link: { color: colors.primary, textDecorationLine: 'underline' },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 4,
  },
  optionChecked: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primarySoft,
  },
  optionLabel: { fontSize: 16, fontWeight: '600' },
  banner: { backgroundColor: colors.warningBackground, borderRadius: radius.md, padding: 12 },
  bannerText: { color: colors.warningText },
});
