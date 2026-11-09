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
