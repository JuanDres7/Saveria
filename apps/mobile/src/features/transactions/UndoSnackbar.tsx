import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';
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
export function UndoSnackbar() {
  const id = useUndo((s) => s.id);
  const clear = useUndo((s) => s.clear);

  useEffect(() => {
    if (id === null) return;
    const timer = setTimeout(clear, UNDO_MS);
    return () => clearTimeout(timer);
  }, [id, clear]);

  if (id === null) return null;
  return (
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <Text style={styles.text}>Movimiento borrado</Text>
      <Pressable
        role="button"
        accessibilityLabel="Deshacer"
        onPress={() => {
          transactionService.restore(id);
          clear();
        }}
      >
        <Text style={styles.action}>Deshacer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 14,
  },
  text: { color: '#ffffff' },
  action: { color: '#5eead4', fontWeight: '700' },
});
