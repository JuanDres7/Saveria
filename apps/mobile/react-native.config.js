// Excluye del build nativo de Android librerías que Bun instala solo porque otra dependencia las
// declara como peer (react-native-drawer-layout, que Expo Router trae) pero que la app NO usa.
// Compilar reanimated además falla en Windows por el límite de 260 caracteres en las rutas.
// Si alguna vez se usan (por ejemplo, un drawer o animaciones), se quita la exclusión.
const unused = ['react-native-reanimated', 'react-native-worklets', 'react-native-gesture-handler'];

module.exports = {
  dependencies: Object.fromEntries(unused.map((name) => [name, { platforms: { android: null } }])),
};
