# Punto de partida de la 003

**Fecha**: 2026-11-10 | **Rama**: `feat/003-visual-redesign` (sobre `develop` + documentos de la 003)

## Pruebas y comprobaciones antes de tocar código (T001)

| Comprobación | Resultado |
|---|---|
| `bun run test` (app, Jest) | 264 pruebas en 20 archivos, todas en verde |
| `bun run test:sqlite` (app, SQLite real) | 16 pruebas, todas en verde |
| `bun test` en `packages/shared` | 118 pruebas, todas en verde |
| `bun test` en `apps/api` | **No corrió**: Docker Desktop apagado y las pruebas de integración necesitan PostgreSQL y Redis (`docker compose up -d postgres redis`). La última corrida completa fue la de cierre de la 002: 456 pruebas. La 003 no toca `apps/api`; se vuelve a correr al final (T066) cuando Docker esté encendido para el emulador |
| `bunx biome check .` | 253 archivos, sin errores |
| `bunx tsc --noEmit` (app) | sin errores |

## Tamaño del paquete (T001)

- `bunx expo export --platform android`: el paquete de Hermes (`.hbc`) pesa **4.061.182 bytes** (4,1 MB). Tardó 29 s.
- Se compara con esta cifra en T063.

## Librerías nuevas (T002 y T003)

- Instaladas con `bunx expo install react-native-svg` (queda en **15.16.0**, la que fija Expo 58) y `bun add lucide-react-native`
  (**1.71.0**). `react-native-safe-area-context` (~5.10.1) y `expo-font` (~58.0.9) siguen como estaban.
- `bunx expo install --check` avisa de varios paquetes de Expo con parche más nuevo (por ejemplo `expo` 58.0.17 frente a 58.0.23 y
  `react-native` 0.88.0 frente a 0.88.1). Es anterior a esta feature y no incluye las dos librerías nuevas; no se tocó.
- **Condiciones (2) y (3) de la constitución v1.2.0**:
  - `lucide-react-native`: sin dependencias propias y sin `fetch`, `XMLHttpRequest` ni `WebSocket` en su código. Cumple.
  - `react-native-svg`: solo hace una petición de red si se usan sus componentes `SvgUri` o `SvgCssUri` con una dirección remota. La
    app no los usa y `theme-tokens.test.ts` (T007) falla si algún archivo de `src/` los importa. Cumple.
- **Letra Bricolage Grotesque** (copiada de `@expo-google-fonts/bricolage-grotesque` 0.4.1, sin dejar el paquete como dependencia),
  licencia OFL 1.1 incluida en `apps/mobile/assets/fonts/OFL.txt`:
  - `BricolageGrotesque_600SemiBold.ttf`: 91.032 bytes, TrueType, trae la característica de cifras tabulares (`tnum`).
  - `BricolageGrotesque_700Bold.ttf`: 90.952 bytes, TrueType, trae `tnum`.
  - Se confirma a ojo en el emulador (T024) que las cifras no «bailan»; si no, la cifra del balance usa la letra del sistema.

## Preparación de las pruebas (T004 y T005)

- `lucide-react-native` publica su versión para Jest como módulo ESM (`.mjs`); `package.json` (clave `jest`) la reemplaza por su
  versión CommonJS con `moduleNameMapper`, y deja `transformIgnorePatterns` igual que el preset de `jest-expo`.
- `jest.setup.ts` simula `react-native-svg` (cada elemento es un `View`), las zonas seguras (margen superior 24, inferior 16) y el
  modo del teléfono (claro por defecto). `tests/support/color-scheme.tsx` trae `renderInBothModes`, `setColorScheme`,
  `withFontScale` y `setSafeAreaInsets`; `tests/test-support.test.tsx` comprueba que funcionan.
- Mobile Jest tras la preparación: 269 pruebas en 21 archivos, en verde (las 264 de antes más 5 de la preparación). Una corrida
  suelta falló una vez en la máquina cargada y no se repitió en dos corridas seguidas.
