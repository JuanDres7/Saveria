// Mocks de los módulos nativos para las pruebas en Node.

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// SecureStore en memoria. `__store` permite vaciarlo entre pruebas.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
  getRandomBytes: (size: number) => new Uint8Array(require('node:crypto').randomBytes(size)),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
  deleteDatabaseSync: jest.fn(),
}));

// react-native-svg: cada elemento se dibuja como un View con sus hijos (en Node no hay motor de SVG).
// Los nombres van escritos uno por uno porque lucide-react-native copia las claves del módulo.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const names = [
    'Svg',
    'Circle',
    'Ellipse',
    'G',
    'Text',
    'TSpan',
    'TextPath',
    'Path',
    'Polygon',
    'Polyline',
    'Line',
    'Rect',
    'Use',
    'Image',
    'Symbol',
    'Defs',
    'LinearGradient',
    'RadialGradient',
    'Stop',
    'ClipPath',
    'Pattern',
    'Mask',
    'Marker',
  ];
  const mocked: Record<string, unknown> = { __esModule: true };
  for (const name of names) {
    const Element = ({ children, ...props }: { children?: unknown; testID?: string }) =>
      React.createElement(View, { ...props, testID: props.testID ?? `svg-${name}` }, children);
    Element.displayName = name;
    mocked[name] = Element;
  }
  mocked.default = mocked.Svg;
  return mocked;
});

// Zonas seguras con márgenes fijos de un teléfono con muesca y barra de gestos. Las pruebas pueden
// cambiarlos con `setSafeAreaInsets` (tests/support/color-scheme.tsx).
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  const insets = { top: 24, bottom: 16, left: 0, right: 0 };
  return { ...actual, useSafeAreaInsets: () => insets, __insets: insets };
});

// Modo claro/oscuro del teléfono controlable desde las pruebas (`setColorScheme` en
// tests/support/color-scheme.tsx). Por defecto es claro, como un teléfono recién configurado.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => {
  const React = require('react');
  const store = {
    value: 'light' as 'light' | 'dark' | null,
    listeners: new Set<() => void>(),
  };
  const useColorScheme = () =>
    React.useSyncExternalStore(
      (listener: () => void) => {
        store.listeners.add(listener);
        return () => store.listeners.delete(listener);
      },
      () => store.value,
    );
  return { __esModule: true, default: useColorScheme, __store: store };
});
