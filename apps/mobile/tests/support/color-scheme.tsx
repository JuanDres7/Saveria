import { act } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

export type Mode = 'light' | 'dark';

type SchemeStore = { value: Mode | null; listeners: Set<() => void> };

function schemeStore(): SchemeStore {
  return (
    jest.requireMock('react-native/Libraries/Utilities/useColorScheme') as { __store: SchemeStore }
  ).__store;
}

/** Cambia el modo del teléfono, también con la pantalla ya dibujada. `null` = el sistema no informa. */
export async function setColorScheme(mode: Mode | null) {
  const store = schemeStore();
  store.value = mode;
  await act(async () => {
    for (const listener of [...store.listeners]) listener();
  });
}

/**
 * Corre `check` una vez en modo claro y otra en oscuro, y deja el modo como estaba.
 * `check` recibe el modo para que la prueba pueda comparar con la paleta que toca.
 */
export function renderInBothModes(name: string, check: (mode: Mode) => Promise<void> | void) {
  for (const mode of ['light', 'dark'] as const) {
    it(`${name} (${mode === 'light' ? 'modo claro' : 'modo oscuro'})`, async () => {
      await setColorScheme(mode);
      try {
        await check(mode);
      } finally {
        await setColorScheme('light');
      }
    });
  }
}

/** Simula el tamaño de letra del sistema (1,5 = 150 %) mientras corre `fn`. */
export async function withFontScale<T>(scale: number, fn: () => Promise<T> | T): Promise<T> {
  const spy = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
  try {
    return await fn();
  } finally {
    spy.mockRestore();
  }
}

/** Cambia los márgenes del sistema (muesca, barra de gestos) para la prueba en curso. */
export function setSafeAreaInsets(
  insets: Partial<Record<'top' | 'bottom' | 'left' | 'right', number>>,
) {
  const mock = jest.requireMock('react-native-safe-area-context') as {
    __insets: Record<string, number>;
  };
  Object.assign(mock.__insets, insets);
}
