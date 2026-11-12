import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Theme, useStyles, useTheme } from '../../theme';
import { BackButton } from '../../ui/BackButton';
import { ScreenBackground } from '../../ui/ScreenBackground';
import { FieldError } from '../auth/components';

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: 16, gap: 14 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerTitle: { ...t.type.subtitle, fontSize: 20, color: t.colors.text, flexShrink: 1 },
    footer: {
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.divider,
      backgroundColor: t.colors.surface,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: t.colors.surfaceSoft,
      borderRadius: t.radius.pill,
      padding: 3,
    },
    segmentOption: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radius.pill,
    },
    segmentChecked: { backgroundColor: t.colors.primary },
    segmentText: { ...t.type.bodyStrong, fontWeight: '500', color: t.colors.textMuted },
    segmentTextChecked: { color: t.colors.onPrimary, fontWeight: '700' },
    amountWrap: { alignItems: 'center', gap: 4, paddingVertical: 4 },
    amount: {
      ...t.type.amountInput,
      alignSelf: 'stretch',
      textAlign: 'center',
      minHeight: 64,
      color: t.colors.text,
      borderWidth: 0,
      borderBottomWidth: 2,
      borderColor: t.colors.border,
    },
    amountError: { borderColor: t.colors.negative },
    caption: { ...t.type.caption, color: t.colors.textMuted },
    label: { ...t.type.bodyStrong, fontSize: 14, color: t.colors.text },
  });

/** Encabezado de los formularios: volver y título (aquí irá el selector «Contar | A mano», docs/mapa-de-la-app.md). */
export function RegisterHeader({ title }: { title: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.header}>
      <BackButton />
      <Text role="heading" style={styles.headerTitle}>
        {title}
      </Text>
    </View>
  );
}

/**
 * Pantalla de formulario: fondo de la marca, encabezado con «Volver» y el contenido que se desplaza,
 * y «Guardar» fijo en el pie (fuera del área que se desplaza) para que el teclado no lo tape.
 */
export function FormScreen({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <ScreenBackground edges={['top']}>
      {/* Con el teclado abierto el pie sube con él: «Guardar» nunca queda tapado. */}
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          testID="form-scroll"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <RegisterHeader title={title} />
          {children}
        </ScrollView>
        <View testID="form-footer" style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

/** Selector de dos o más opciones en una sola píldora (por ejemplo «Gasto | Ingreso»). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={checked}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={[styles.segmentOption, checked ? styles.segmentChecked : null]}
          >
            <Text style={[styles.segmentText, checked ? styles.segmentTextChecked : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Monto grande y centrado, con su moneda debajo. La etiqueta es su nombre accesible. */
export function AmountField({
  label,
  caption,
  value,
  onChangeText,
  placeholder,
  error,
  autoFocus,
}: {
  label: string;
  caption?: string;
  value: string;
  onChangeText(text: string): void;
  placeholder?: string;
  error?: string;
  autoFocus?: boolean;
}) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.amountWrap}>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        autoFocus={autoFocus}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.border}
        cursorColor={theme.colors.primary}
        selectionColor={theme.colors.primary}
        style={[styles.amount, error ? styles.amountError : null]}
      />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

/** Etiqueta de un grupo de opciones («Categoría», «Cuenta», «Fecha»…). */
export function FormLabel({ label }: { label: string }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.label}>{label}</Text>;
}
