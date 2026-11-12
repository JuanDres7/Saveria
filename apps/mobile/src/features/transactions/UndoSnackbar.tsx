import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';
import { type Theme, useStyles } from '../../theme';
import { transactionService } from './transaction-service';

/** Cuánto tiempo se ofrece "Deshacer" (FR-026: al menos 5 segundos). */
export const UNDO_MS = 6000;

interface UndoState {
  /** El movimiento recién borrado, o `null` si no hay nada que deshacer. */
  id: string | null;
  offer(id: string): void;
  clear(): void;
}

export const useUndo = create<UndoState>((set) => ({
  id: null,
  offer: (id) => set({ id }),
  clear: () => set({ id: null }),
}));

/**
 * Aviso inferior "Movimiento borrado · Deshacer". Vive fuera de las pantallas (en el layout de la
 * app) para seguir visible después de volver a la lista. Cada borrado reinicia el tiempo.
 */
export function UndoSnackbar({ bottomOffset = 24 }: { bottomOffset?: number }) {
  const styles = useStyles(makeStyles);
  const id = useUndo((s) => s.id);
  const clear = useUndo((s) => s.clear);

  useEffect(() => {
    if (id === null) return;
    const timer = setTimeout(clear, UNDO_MS);
    return () => clearTimeout(timer);
  }, [id, clear]);

  if (id === null) return null;
  return (
    <View
      testID="undo-snackbar"
      style={[styles.bar, { bottom: bottomOffset }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>Movimiento borrado</Text>
      <Pressable
        role="button"
        accessibilityLabel="Deshacer"
        onPress={() => {
          transactionService.restore(id);
          clear();
        }}
        style={styles.action}
      >
        <Text style={styles.actionText}>Deshacer</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    bar: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: t.colors.inverse,
      borderRadius: t.radius.control,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    text: { ...t.type.body, color: t.colors.onInverse },
    action: {
      minHeight: t.touch,
      justifyContent: 'center',
      paddingLeft: 12,
    },
    actionText: {
      ...t.type.bodyStrong,
      color: t.colors.onInverse,
      textDecorationLine: 'underline',
    },
  });
