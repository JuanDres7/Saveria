---

description: "Tareas de la feature 003-visual-redesign"
---

# Tasks: Rediseño visual de la app

**Input**: Documentos de diseño en `specs/003-visual-redesign/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/ui-contract.md](contracts/ui-contract.md),
[quickstart.md](quickstart.md). La constitución v1.2.0 ya permite las dos librerías de interfaz.

**Tests**: OBLIGATORIAS por la Constitución VIII. Dentro de cada historia, las pruebas se escriben primero y
deben fallar antes de implementar. Toda prueba visual corre en modo claro y en modo oscuro.

**Organization**: Tareas agrupadas por historia de usuario. Como esta feature no cambia datos ni API, solo se toca
`apps/mobile`; `packages/shared`, `apps/api` y `openapi.yaml` quedan igual.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos y sin dependencias pendientes)
- **[Story]**: historia de usuario a la que pertenece (US1…US7)

## Path Conventions

- App: `apps/mobile/src/` (rutas de Expo Router en `apps/mobile/src/app/`), pruebas en `apps/mobile/tests/`
- Tema: `apps/mobile/src/theme/`; piezas compartidas nuevas: `apps/mobile/src/ui/`
- Comandos: Bun (`bun`, `bunx`). Bun no está en el PATH fijo: `export PATH="$HOME/.bun/bin:$PATH"`.
  Las pruebas de la app se corren con `cd apps/mobile && bun run test`.
- Emulador: `saveria_spike`, con `adb` + uiautomator (ayudante `ui.py` y `launch.sh` del scratchpad).
  Cambiar de modo: `adb shell cmd uimode night yes` / `night no`.
- Colores: solo en `apps/mobile/src/theme/palettes.ts`; ninguna otra pieza lleva `#hex`, `rgb(` ni `rgba(`.
- Los nombres accesibles (`accessibilityLabel`, `accessibilityRole`) y los `testID` que ya usan las pruebas de la 001
  y la 002 se conservan. Si una prueba existente falla por un cambio de texto o de estructura, se corrige la causa, no
  la prueba, salvo que la prueba compruebe un color o una medida que cambió a propósito.
- Sin funciones nuevas (FR-019): no hay tarjeta de «gasto del mes», gráficos, metas ni resumen en ninguna pantalla.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Medir el punto de partida e instalar las dos librerías de interfaz

- [ ] T001 Medir el punto de partida y guardarlo en `specs/003-visual-redesign/checklists/baseline.md`: correr `bun run test`, `bun run test:sqlite`, `bun run lint` y `bunx tsc --noEmit` en `apps/mobile` y `bun test` en `apps/api` y `packages/shared` (anotar cuántas pruebas pasan); medir el tamaño del paquete con `bunx expo export --platform android --output-dir ../../.scratch-export` y anotar los bytes del `.hbc`; borrar la carpeta de salida
- [ ] T002 Instalar las dos librerías en `apps/mobile/package.json`: `bunx expo install react-native-svg` (debe quedar en 15.16.0) y `bun add lucide-react-native`; comprobar con `bunx expo install --check` que no hay versiones fuera de Expo 58; confirmar que `react-native-safe-area-context` sigue en `~5.10.1` y que no se agrega nada más
- [ ] T003 [P] Preparar Jest para las librerías nuevas en `apps/mobile/package.json` (clave `jest`, `transformIgnorePatterns` si `lucide-react-native` o `react-native-svg` lo piden) y en `apps/mobile/jest.setup.ts`: simular `react-native-svg` (cada elemento se dibuja como un `View` con sus hijos) y `react-native-safe-area-context` con márgenes fijos (`top: 24, bottom: 16`) que las pruebas puedan cambiar
- [ ] T004 [P] Crear el ayudante de pruebas `apps/mobile/tests/support/color-scheme.tsx`: `renderInBothModes(ui, check)` que simula `useColorScheme` en `light` y en `dark`, ejecuta la comprobación en cada modo y limpia al terminar; `setColorScheme(mode)` para cambiarlo con la pantalla ya dibujada

**Checkpoint**: las pruebas de la 001 y la 002 siguen en verde con las librerías instaladas.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tema de dos paletas, íconos, piezas compartidas y componentes base. Nada de las historias empieza antes.

### Tests (escribirlas primero; deben fallar)

- [ ] T005 [P] Escribir `apps/mobile/tests/theme-contrast.test.ts`: calcula la razón de contraste WCAG sobre `theme/palettes.ts` y exige 4,5 en cada par de la tabla de `data-model.md` (`text` y `textMuted` sobre `background`, `surface` y `surfaceSoft`; `onPrimary` sobre `primary`; `primary` sobre `background`, `surface` y `sage`; `negative` y `positive` sobre `background` y `surface`; `warningText` sobre `warningBackground`; `onInverse` sobre `inverse`) y 3,0 en `border` sobre `background` y `surface`, en las dos paletas (FR-029, SC-002)
- [ ] T006 [P] Escribir `apps/mobile/tests/theme-tokens.test.ts`: recorre `apps/mobile/src/` y falla si encuentra `#rrggbb`, `#rgb`, `rgb(` o `rgba(` fuera de `theme/palettes.ts` (FR-007, SC-007); comprueba que las paletas clara y oscura tienen exactamente los mismos tokens
- [ ] T007 [P] Escribir `apps/mobile/tests/category-icons.test.ts`: cada `slug` de `CATEGORIES` (`packages/shared/src/catalog/categories.ts`: 18 de gasto y 8 de ingreso), la transferencia y el ajuste de saldo tienen ícono; cada ícono del mapa existe en `lucide-react-native`; un `slug` desconocido cae en el ícono de «otros» (FR-009)
- [ ] T008 [P] Escribir `apps/mobile/tests/theme-hook.test.tsx`: `useTheme()` devuelve la paleta clara con `light` o sin modo, y la oscura con `dark`; cambiar el modo con el componente ya dibujado vuelve a dibujarlo sin desmontarlo; `useStyles` memoriza por modo (FR-027, FR-028)
- [ ] T009 [P] Escribir `apps/mobile/tests/ui-parts.test.tsx`: `Icon` oculto a lectores de pantalla salvo que sea el único contenido de un control; `CategoryIcon` dibuja el círculo `sage`; `Card` no es tocable; `ScreenBackground` deja el contenido dentro de los márgenes del sistema y las formas fuera del orden de foco (contrato 2 y 2b)
- [ ] T010 [P] Escribir `apps/mobile/tests/ui-base-components.test.tsx`: `Screen`, `Field`, `PrimaryButton`, `TextButton`, `Banner`, `RadioOption` y `Chip` en los dos modos conservan sus nombres accesibles y roles, tienen objetivo táctil ≥ 48 dp, el botón principal es ancho, el campo con error muestra ícono y texto además del color, y el texto escala con el tamaño de letra del sistema (FR-002, FR-003, FR-023 a FR-026)

### Implementation

- [ ] T011 Crear `apps/mobile/src/theme/palettes.ts` con el tipo `ThemeColors` y las paletas `lightColors` y `darkColors` con los valores exactos de `data-model.md` (`background`, `surface`, `surfaceSoft`, `sage`, `shape`, `primary`, `onPrimary`, `text`, `textMuted`, `border`, `divider`, `disabled`, `negative`, `positive`, `warningBackground`, `warningText`, `inverse`, `onInverse`); el tipo obliga a que las dos paletas tengan los mismos nombres. Es el único archivo con colores
- [ ] T012 [P] Crear `apps/mobile/src/theme/tokens.ts` con radios (`card` 24, `row` 22, `control` 16, `pill` 999), espacios (4, 8, 12, 16, 20, 24, 32), `touch` 48, tamaño de ícono (20 en filas, 24 en barra, trazo 1,75), escala de texto de la fuente del sistema (título 24/700, subtítulo 16/700, texto 15/400, ayuda 13/400, cifra grande 30/700 con cifras tabulares) y sombras (leve en claro; elevación mayor en oscuro)
- [ ] T013 Convertir `apps/mobile/src/theme.ts` en `apps/mobile/src/theme/index.ts` (con `git mv`): `useTheme()` (modo desde `useColorScheme()`, `light` si el sistema no informa), `useStyles(factory)` y, mientras se migran las pantallas, una exportación `colors` marcada `@deprecated` con la paleta clara y los nombres viejos (`primarySoft`, `textStrong`, `inverseAccent`) para que lo que aún no se migró compile; los imports `../theme` siguen valiendo. Pasan T006 (salvo los colores sueltos de las pantallas), T008
- [ ] T014 [P] Crear `apps/mobile/src/ui/category-icons.ts` (mapa `slug` → ícono de lucide, según `data-model.md`; transferencia `ArrowLeftRight`, ajuste `Scale`, «otros» como respaldo) y `apps/mobile/src/ui/CategoryIcon.tsx` (círculo `sage` con el ícono en `primary`). Pasa T007
- [ ] T015 [P] Crear `apps/mobile/src/ui/Icon.tsx`: envuelve un ícono de lucide con color de un token del tema (por defecto `text`), tamaño y trazo de `tokens.ts` y oculto a lectores de pantalla (`accessibilityElementsHidden`, `importantForAccessibility="no"`) salvo que se indique lo contrario
- [ ] T016 [P] Crear `apps/mobile/src/ui/Card.tsx`: tarjeta con radio `card`, sombra del tema y fondo `surface` o `surfaceSoft` (`tone`); no tocable por sí sola
- [ ] T017 [P] Crear `apps/mobile/src/ui/ScreenBackground.tsx`: fondo `background` y dos o tres círculos `shape` con opacidad dibujados con `react-native-svg`, detrás del contenido y fuera del orden de foco; el contenido queda dentro de los márgenes de `useSafeAreaInsets()` de `react-native-safe-area-context`. Pasan T009
- [ ] T018 Hacer que `apps/mobile/src/app/_layout.tsx` siga el modo: `StatusBar` de `expo-status-bar` con el estilo del tema y `SystemUI.setBackgroundColorAsync` de `expo-system-ui` con `background` para que no destelle en blanco al abrir ni al cambiar de modo (caso límite de arranque)
- [ ] T019 [P] Actualizar `apps/mobile/app.json`: pantalla de arranque crema `#F6F3EA` en claro y `#14180F` en oscuro (variante `dark` del plugin `expo-splash-screen`), fondo del ícono adaptable en crema, `userInterfaceStyle` sigue en `automatic`. Estos valores viven en la configuración de Expo, fuera de `src/`, y el sistema los lee antes de que arranque la app
- [ ] T020 Restyle de los componentes base en `apps/mobile/src/features/auth/components.tsx` (`Screen` con `ScreenBackground` y márgenes del sistema, `Field`, `PrimaryButton` ancho con ícono opcional, `TextButton`, `Banner`, `RadioOption`, `styles` y `Screen` de formularios con botón fijo en pie) usando `useTheme`/`useStyles`; mismos nombres accesibles. Pasa T010 para esas piezas
- [ ] T021 [P] Restyle de `apps/mobile/src/features/transactions/Chip.tsx` en forma de píldora (`pill`): elegido en `primary` con `onPrimary`, no elegido en `surface`, objetivo ≥ 48 dp. Pasa T010
- [ ] T022 Reconstruir e instalar la app de desarrollo en el emulador, porque `react-native-svg` es un módulo nativo y la pantalla de arranque cambió: `cd apps/mobile && bunx expo run:android`; abrir con `launch.sh`, comprobar que la bienvenida se ve en claro y en oscuro (`night no` / `night yes`), sin destello blanco ni azul al abrir, y registrar el resultado en `specs/003-visual-redesign/checklists/visual-review.md`

**Checkpoint**: T005 a T010 en verde, `bun run test`, `bun run lint` y `bunx tsc --noEmit` sin errores, la app abre en el emulador en los dos modos. Las historias pueden empezar.

---

## Phase 3: User Story 1 - Inicio con identidad propia (Priority: P1) 🎯 MVP

**Goal**: Inicio con saludo, tarjeta grande de balance, cuentas y últimos movimientos con la identidad nueva.

**Independent Test**: con varias cuentas y movimientos, Inicio muestra todo con el estilo nuevo y los mismos números que antes.

### Tests for User Story 1 (escribirlas primero; deben fallar)

- [ ] T023 [P] [US1] Escribir `apps/mobile/tests/balance-card.test.ts` para `selectBalanceCard(summary, defaultAccount)`: devuelve el total y la moneda principal cuando todas las cuentas activas están en la moneda principal; si no, el saldo de la cuenta por defecto con su nombre, sin mezclar monedas; las cuentas archivadas no suman; sin cuentas locales usa la cuenta por defecto del perfil (FR-012, escenarios 1.2)
- [ ] T024 [P] [US1] Escribir `apps/mobile/tests/us1-home-visual.test.tsx` con `renderInBothModes`: saludo «Hola, {nombre}» (FR-017); tarjeta de balance; una tarjeta por cuenta con el saldo en su moneda; saldo negativo en `negative` con signo; movimientos con `CategoryIcon`, título, fecha y monto con signo y color; estado sin movimientos con mensaje amable que invita a registrar el primero; sin conexión muestra los mismos datos; «Registrar movimiento» solo con moneda principal y «Transferir» solo con dos cuentas activas; los números son los mismos que con la pantalla anterior (escenarios 1.1 a 1.6)

### Implementation for User Story 1

- [ ] T025 [US1] Crear `apps/mobile/src/features/accounts/balance-card.ts` con `selectBalanceCard` usando `summarizeAccounts` de `features/transactions/ledger.ts`. Pasa T023
- [ ] T026 [P] [US1] Crear `apps/mobile/src/features/accounts/BalanceCard.tsx`: `Card` grande con etiqueta («Tu balance total» o «Saldo de {cuenta}» cuando no hay total), cifra grande que reduce su tamaño antes de cortarse, moneda al lado y cifras tabulares
- [ ] T027 [P] [US1] Crear `apps/mobile/src/features/accounts/AccountCard.tsx`: tarjeta de cuenta con nombre y saldo en su moneda (negativo en `negative` con signo), `accessibilityLabel` «Saldo de {nombre}» como hoy; se reutiliza en la lista de cuentas (US5)
- [ ] T028 [US1] Restyle de `apps/mobile/src/features/transactions/RecentList.tsx`: `TransactionRow` con `CategoryIcon`, título, fecha y monto con signo (`negative`/`positive`); `DayHeader`; `DaySections` dentro de una `Card`; quitar la constante `NEGATIVE_COLOR` y usar el tema (la importan `home.tsx` y otros: actualizar sus imports); transferencias y ajustes con sus íconos
- [ ] T029 [US1] Rediseñar `apps/mobile/src/app/(app)/home.tsx`: `ScreenBackground`, saludo con el nombre (misma regla de nombre de hoy), `VerifyBanner`, `BalanceCard`, botón principal ancho «Registrar movimiento» con ícono `Plus`, «Transferir», «Tus cuentas» con `AccountCard`, «Últimos movimientos» con `DaySections` y «Ver todo»; el estado vacío con mensaje amable. Mientras no exista la barra inferior (US4), «Cuentas de dinero», «Configuración» y «Cerrar sesión» quedan como enlaces discretos al pie. Pasa T024
- [ ] T030 [US1] Verificar Inicio en el emulador en modo claro y oscuro con `qs002.final@mail.com` / `clave1234` (varias cuentas y movimientos) y con una cuenta nueva (estado vacío); capturas junto a `inspiracion/Inspiracion.png` en `checklists/visual-review.md`; pedir la aprobación del dueño del proyecto (SC-008) antes de seguir

**Checkpoint**: Inicio funciona y se aprueba por sí solo. Esto es el MVP del rediseño.

---

## Phase 4: User Story 2 - Registrar un movimiento con el nuevo estilo (Priority: P1)

**Goal**: Registrar, editar y transferir con la identidad nueva, sin pasos extra ni perder el botón de guardar.

**Independent Test**: registrar un gasto típico y contar los toques (máx. 3 más el monto); el formulario se ve igual de claro con teclado abierto.

### Tests for User Story 2 (escribirlas primero; deben fallar)

- [ ] T031 [P] [US2] Escribir `apps/mobile/tests/us2-record-visual.test.tsx` con `renderInBothModes`: cada categoría con su ícono y nombre (2.1); escribir el monto, tocar la categoría y guardar registra el gasto con cuenta y fecha por defecto, en máx. 3 toques más el monto (2.2); al tocar una categoría se cierra el teclado y «Guardar» queda visible en el pie (2.3); sin monto o sin categoría el error se ve junto al campo con ícono y texto (2.4); editar un movimiento y transferir usan los mismos campos, chips y botones (2.5)

### Implementation for User Story 2

- [ ] T032 [US2] Restyle de `apps/mobile/src/features/transactions/TransactionForm.tsx`: tipo gasto/ingreso en chips, monto grande, categorías como chips con `CategoryIcon`, cuenta y fecha, y botón «Guardar» fijo en el pie fuera del `ScrollView` sumando el margen inferior del sistema; conserva `Keyboard.dismiss()` al tocar categoría. Pasa T031
- [ ] T033 [P] [US2] Restyle de `apps/mobile/src/features/transactions/TransferFormView.tsx` con los mismos campos, chips «Hacia {cuenta}» y botón de pie
- [ ] T034 [P] [US2] Ajustar las pantallas `apps/mobile/src/app/(app)/transactions/new.tsx`, `apps/mobile/src/app/(app)/transactions/[id].tsx` y `apps/mobile/src/app/(app)/transfer.tsx` a `Screen`/`ScreenBackground` y a los márgenes del sistema, sin cambiar su lógica
- [ ] T035 [US2] Verificar en el emulador, en claro y oscuro: registrar un gasto (contar toques y que «Guardar» no quede bajo el teclado ni la barra de gestos), editar, transferir y borrar con «Deshacer»; medir SC-001 con 5000 movimientos sembrados (`EXPO_PUBLIC_SEED_TRANSACTIONS=5000`): ≤ 1,5 s; capturas y aprobación en `checklists/visual-review.md`

**Checkpoint**: Inicio y Registrar funcionan y se aprueban por separado.

---

## Phase 5: User Story 3 - Entrar y empezar con la misma identidad (Priority: P1)

**Goal**: Bienvenida, registro, inicio de sesión, recuperar contraseña y los 5 pasos del onboarding con la identidad nueva.

**Independent Test**: recorrer sin sesión desde la bienvenida hasta terminar el onboarding; el comportamiento no cambia.

### Tests for User Story 3 (escribirlas primero; deben fallar)

- [ ] T036 [P] [US3] Escribir `apps/mobile/tests/us3-auth-visual.test.tsx` con `renderInBothModes`: la bienvenida con marca, mensaje breve y acciones principales (3.1); registro, inicio de sesión y recuperar contraseña con los mismos campos, errores y botones (3.2); cada uno de los 5 pasos del onboarding muestra su avance («Paso X de 5») y una sola acción principal (3.3); la casilla de la política de datos se lee marcada y sin marcar, con ícono además del color (3.4); los nombres accesibles y los `testID` de `us1-auth`, `us2-onboarding` y `us5-session` siguen valiendo

### Implementation for User Story 3

- [ ] T037 [US3] Rediseñar `apps/mobile/src/app/(auth)/welcome.tsx` con `ScreenBackground`, la marca (`Leaf` + «Saveria»), un mensaje cercano y breve y los botones de crear cuenta e iniciar sesión (principal y secundario)
- [ ] T038 [P] [US3] Restyle de `apps/mobile/src/app/(auth)/register.tsx`, `apps/mobile/src/app/(auth)/login.tsx`, `apps/mobile/src/app/(auth)/forgot-password.tsx` y `apps/mobile/src/app/(auth)/_layout.tsx`, incluida la casilla de la política de datos
- [ ] T039 [P] [US3] Crear `apps/mobile/src/features/onboarding/StepProgress.tsx` (indicador de avance de 5 pasos) y restyle de las cinco pantallas `apps/mobile/src/app/(onboarding)/country.tsx`, `currency.tsx`, `city.tsx`, `ai-name.tsx`, `ai-mode.tsx` y de `apps/mobile/src/app/(onboarding)/_layout.tsx`, con `RadioOption` y el botón principal en el pie
- [ ] T040 [US3] Verificar en el emulador, en claro y oscuro, el recorrido completo sin sesión con una cuenta nueva (bienvenida → crear cuenta → 5 pasos → Inicio) y un inicio de sesión con «olvidé mi contraseña»; capturas y aprobación en `checklists/visual-review.md`

**Checkpoint**: las tres historias P1 se aprueban. La app ya tiene su identidad en las pantallas más vistas.

---

## Phase 6: User Story 4 - Navegar con una barra inferior (Priority: P2)

**Goal**: Barra de cuatro secciones (Inicio, Movimientos, Cuentas, Ajustes) con la sección actual marcada, sin mover rutas.

**Independent Test**: desde cualquier sección principal se llega a las demás con un toque y la actual se ve marcada.

### Tests for User Story 4 (escribirlas primero; deben fallar)

- [ ] T041 [P] [US4] Escribir `apps/mobile/tests/us4-tabbar.test.tsx` con `renderInBothModes`: cuatro secciones con ícono y nombre, la actual marcada (4.1); tocar otra sección llega a ella y al volver conserva donde estaba (4.2); la barra no aparece en formularios ni detalle (editar, transferir, ajustar saldo, nueva cuenta) y «Guardar» sigue a la vista (4.3); funciona sin conexión (4.4); no aparece sin sesión, en el onboarding ni en `verify-email-gate` (4.5); «Registrar movimiento» y «Transferir» se alcanzan desde Inicio y desde el detalle de una cuenta con un toque (4.6); la barra suma el margen inferior del sistema y cada destino mide ≥ 48 dp
- [ ] T042 [P] [US4] Actualizar `apps/mobile/tests/guards.test.tsx` para la estructura con barra: las mismas rutas protegidas siguen protegidas (`home`, `transactions/*`, `transfer`, `accounts/*`, `settings/*`) y `verify-email-gate` sigue siendo la única pantalla del grupo de verificación

### Implementation for User Story 4

- [ ] T043 [US4] Crear `apps/mobile/src/ui/TabBar.tsx` con las cuatro secciones (`House`, `ReceiptText`, `Wallet`, `Settings`), la actual con fondo `sage` y texto en negrita, objetivo ≥ 48 dp, `accessibilityRole="tab"` y estado seleccionado, y el margen inferior del sistema sumado a su alto
- [ ] T044 [US4] Cambiar `apps/mobile/src/app/(app)/_layout.tsx` de `Stack` a `Tabs` de expo-router con `TabBar` propia: pestañas `home`, `transactions/index`, `accounts/index`, `settings/index`; el resto de las rutas declaradas pero ocultas de la barra; la barra solo se pinta cuando la ruta actual es una de las cuatro; mantener los guardias de `routeGroupFor` (confirmar si `Tabs.Protected` existe en expo-router ~58; si no, redirigir en el propio layout) y `UndoSnackbar` fuera de las pantallas, ahora por encima de la barra. Pasan T041 y T042
- [ ] T045 [US4] Quitar de `apps/mobile/src/app/(app)/home.tsx` los tres enlaces provisionales («Cuentas de dinero», «Configuración», «Cerrar sesión») y agregar «Cerrar sesión» a `apps/mobile/src/app/(app)/settings/index.tsx` con su misma acción (`authService.logout()`); agregar «Registrar movimiento» y «Transferir» al detalle de cuenta `apps/mobile/src/app/(app)/accounts/[id].tsx` si aún no los tiene, solo como atajos a las pantallas que ya existen
- [ ] T046 [US4] Verificar en el emulador, en claro y oscuro: cambiar de sección, volver con «atrás» (comprobar que dos «atrás» desde Inicio salen de la app y que «atrás» desde un formulario vuelve a su sección), barra oculta en formularios, sin conexión, y con navegación por gestos y por tres botones, en un perfil de pantalla pequeña y otro grande (`adb shell wm size`); capturas y aprobación en `checklists/visual-review.md`

**Checkpoint**: la navegación nueva funciona sin romper las rutas ni las pruebas existentes.

---

## Phase 7: User Story 5 - Historial y cuentas con el nuevo estilo (Priority: P2)

**Goal**: Historial con filtros en chips y lista por día; cuentas como tarjetas; detalle, archivadas, nueva y ajustar saldo con el mismo estilo.

**Independent Test**: recorrer historial, lista de cuentas, nueva cuenta, detalle, archivadas y ajustar saldo.

### Tests for User Story 5 (escribirlas primero; deben fallar)

- [ ] T047 [P] [US5] Escribir `apps/mobile/tests/us5-lists-visual.test.tsx` con `renderInBothModes`: el historial agrupa por día con ícono, título, fecha y monto con signo y color, y los filtros existentes se ven como chips (5.1); cada cuenta es una tarjeta con su nombre, tipo y saldo en su moneda, con la marcada por defecto señalada con texto (5.2); archivar, reactivar, ajustar saldo y marcar por defecto conservan su comportamiento y sus avisos (5.3); un movimiento o cuenta rechazado por el servidor muestra el aviso con ícono, texto y acción de corregir (5.4); la lista larga sigue cargando por páginas (5.5)

### Implementation for User Story 5

- [ ] T048 [US5] Restyle de `apps/mobile/src/app/(app)/transactions/index.tsx` (historial): filtros existentes como `Chip`, lista con `DaySections` y `CategoryIcon`, misma paginación; sin tarjeta de resumen ni totales nuevos (FR-019). Pasa T047 para el historial
- [ ] T049 [P] [US5] Restyle de `apps/mobile/src/features/accounts/AccountList.tsx` con `AccountCard` y de `apps/mobile/src/app/(app)/accounts/index.tsx`; restyle de `apps/mobile/src/features/accounts/AccountFields.tsx` y de `apps/mobile/src/app/(app)/accounts/new.tsx`
- [ ] T050 [P] [US5] Restyle de `apps/mobile/src/app/(app)/accounts/[id].tsx`, `apps/mobile/src/app/(app)/accounts/archived.tsx` y `apps/mobile/src/app/(app)/accounts/[id]/adjust.tsx` (la vista previa de la diferencia con los mismos números), con los avisos de rechazo del servidor legibles en los dos modos
- [ ] T051 [US5] Verificar en el emulador, en claro y oscuro, con 5000 movimientos sembrados: desplazar el historial sin trabarse (SC-004: ≤ 8 ms / 11 ms por cuadro, medido como en la 002), crear, archivar y reactivar una cuenta y ajustar un saldo; capturas y aprobación en `checklists/visual-review.md`

**Checkpoint**: todas las pantallas de uso diario tienen la identidad nueva.

---

## Phase 8: User Story 7 - Modo claro y modo oscuro (Priority: P2)

**Goal**: Las dos variantes se ven bien en todas las pantallas ya rediseñadas y el cambio de modo con la app abierta no pierde nada. La base (paletas, `useTheme`, arranque) ya está en la fase 2; esta fase la comprueba de punta a punta sobre lo hecho hasta aquí (las pantallas de US6 se revisan en su propia fase).

**Independent Test**: recorrer las pantallas con el teléfono en modo claro y en oscuro y cambiar de modo con un formulario a medias.

### Tests for User Story 7 (escribirlas primero; deben fallar)

- [ ] T052 [P] [US7] Escribir `apps/mobile/tests/us7-modes.test.tsx`: en `light` y en `dark`, Inicio, Registrar, Historial, Cuentas y la bienvenida se dibujan sin errores y con colores solo del tema (7.1, 7.2); cambiar el modo con «Registrar movimiento» abierto y un monto escrito mantiene la pantalla, el monto y la categoría elegida (7.3, FR-030); montos con signo en `negative`/`positive` de cada modo (7.4); avisos, tarjetas, chips y campos distinguibles del fondo (7.5)

### Implementation for User Story 7

- [ ] T053 [US7] Corregir lo que T052 y el recorrido revelen en `apps/mobile/src/theme/palettes.ts` y en las piezas afectadas (solo ajustes de tokens o de uso del tema, sin colores sueltos)
- [ ] T054 [US7] Recorrer en el emulador las pantallas de US1 a US5 en modo oscuro y en claro; con un formulario a medias correr `adb shell cmd uimode night yes` y `night no` y comprobar que sigue en la misma pantalla con lo escrito (escenario 7.3); abrir la app en frío en oscuro y comprobar que no destella en blanco; poner el tamaño de letra al máximo y comprobar que nada se corta (SC-005); capturas y aprobación en `checklists/visual-review.md`

**Checkpoint**: claro y oscuro validados en todo lo hecho hasta aquí.

---

## Phase 9: User Story 6 - Configuración y avisos coherentes (Priority: P3)

**Goal**: Configuración, cambiar contraseña, borrar cuenta, bloqueo de verificación y avisos con la misma identidad y un tono claro en acciones delicadas.

**Independent Test**: recorrer Configuración y sus pantallas, el bloqueo de verificación y los avisos.

### Tests for User Story 6 (escribirlas primero; deben fallar)

- [ ] T055 [P] [US6] Escribir `apps/mobile/tests/us6-settings-visual.test.tsx` con `renderInBothModes`: Configuración agrupa sus opciones en tarjetas con ícono (6.1); borrar la cuenta conserva el texto inequívoco de que es definitivo, sin tono motivador (6.2, FR-018); el aviso «Movimiento borrado · Deshacer» y el de correo sin verificar son legibles, y «Deshacer» dura los mismos 6 s (6.3); el bloqueo por correo sin verificar conserva su comportamiento y sus acciones (6.4); «Cerrar sesión» está en Configuración

### Implementation for User Story 6

- [ ] T056 [P] [US6] Restyle de `apps/mobile/src/app/(app)/settings/index.tsx` (opciones en `Card` con `Icon`, incluido «Cerrar sesión»), `apps/mobile/src/app/(app)/settings/change-password.tsx` y `apps/mobile/src/app/(app)/settings/delete-account.tsx` (texto definitivo e inequívoco)
- [ ] T057 [P] [US6] Restyle de `apps/mobile/src/app/(app)/verify-email-gate.tsx`, `apps/mobile/src/features/verification/VerifyBanner.tsx` (ícono `Mail`) y `apps/mobile/src/features/transactions/UndoSnackbar.tsx` (colores `inverse`/`onInverse`, por encima de la barra con el margen del sistema, misma duración de 6 s)
- [ ] T058 [US6] Verificar en el emulador, en claro y oscuro: Configuración, cambiar contraseña, borrar cuenta (sin confirmar), bloqueo de verificación (cuenta sin verificar), aviso «Deshacer» y el aviso de que no se pudo guardar; capturas y aprobación en `checklists/visual-review.md`

**Checkpoint**: las 23 pantallas tienen la identidad nueva.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Cierre, limpieza del tema y registro de resultados

- [ ] T059 Retirar la exportación `colors` `@deprecated` de `apps/mobile/src/theme/index.ts` y los nombres viejos; reemplazar los usos que queden por `useTheme()`; agregar a `apps/mobile/tests/theme-tokens.test.ts` que ningún archivo de `src/` importa `colors` de `../theme`. Ajustar `apps/mobile/tests/us2-history.test.tsx` si su comprobación del color rojo apuntaba al valor anterior (ahora debe leerlo del tema)
- [ ] T060 Recorrer completo `quickstart.md` en el emulador, en claro y en oscuro, y registrar el resultado en `specs/003-visual-redesign/checklists/quickstart-run.md`, incluido el paso de pantallas de otro tamaño (pequeña, grande, gestos y tres botones) y el paso sin conexión
- [ ] T061 Medir y registrar en `checklists/quickstart-run.md`: SC-001 (registrar un gasto ≤ 1,5 s) y SC-004 (5000 movimientos ≤ 8 ms / 11 ms por cuadro) en el emulador, y comparar el tamaño del paquete con el de T001 (anotar la diferencia; si crece de forma desproporcionada, importar los íconos por archivo)
- [ ] T062 [P] Revisar los registros de la app y de la API durante el recorrido: sin montos, correos ni tokens (misma comprobación de la 001 y la 002); anotar el resultado en `checklists/quickstart-run.md`
- [ ] T063 [P] Actualizar `README.md` (sección de la app: tema claro/oscuro, íconos y cómo cambiar de modo en el emulador) y `specs/003-visual-redesign/checklists/requirements.md` si algún requisito cambió
- [ ] T064 Correr todas las pruebas y comprobaciones (`bun run test`, `bun run test:sqlite`, `bun run lint`, `bunx tsc --noEmit` en `apps/mobile`; `bun test` en `apps/api` y `packages/shared`), confirmar que no hay menos pruebas que en `baseline.md` y marcar todas las tareas
- [ ] T065 Actualizar la memoria del proyecto (`project-workflow-and-git.md`) con el estado de la 003 y dejar la rama lista para su PR a `develop` (sin abrirlo hasta que el usuario lo pida)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup y bloquea todas las historias.
- **US1, US2, US3 (P1)**: dependen de la fase 2; entre sí son independientes, pero se hacen en este orden para ir aprobando de a un grupo de pantallas (SC-008).
- **US4 (P2)**: depende de US1 (Inicio) porque quita los enlaces provisionales; y de la fase 2.
- **US5 (P2)**: depende de la fase 2 y de `AccountCard` y `RecentList` de US1.
- **US7 (P2)**: depende de que existan las pantallas de US1 a US5 para recorrerlas.
- **US6 (P3)**: depende de la fase 2 y de US4 (el aviso «Deshacer» va sobre la barra y «Cerrar sesión» ya se movió a Configuración).
- **Polish (Phase 10)**: depende de todas las historias; retirar `colors` (T059) solo cuando ninguna pantalla lo use.

### Within Each User Story

- Las pruebas se escriben primero y deben fallar.
- Piezas compartidas antes que las pantallas que las usan.
- La verificación en el emulador (y la aprobación) cierra cada historia.

### Parallel Opportunities

- Fase 1: T003 y T004 en paralelo después de T002.
- Fase 2: T005 a T010 (pruebas) en paralelo; T012, T014 a T017, T019 y T021 en paralelo después de T011.
- US1: T023 y T024 en paralelo; T026 y T027 en paralelo.
- US2: T033 y T034 en paralelo. US3: T038 y T039 en paralelo. US5: T049 y T050 en paralelo. US6: T056 y T057 en paralelo.
- Las historias no se hacen en paralelo entre sí por una sola persona, pero cada una podría asignarse por separado.

---

## Parallel Example: Phase 2 (pruebas)

```text
T005 theme-contrast.test.ts        T006 theme-tokens.test.ts       T007 category-icons.test.ts
T008 theme-hook.test.tsx           T009 ui-parts.test.tsx          T010 ui-base-components.test.tsx
```

---

## Implementation Strategy

### MVP First (US1)

1. Setup + Foundational (T001–T022): tema de dos paletas, íconos, componentes base y arranque.
2. US1 Inicio (T023–T030): primera pantalla completa en claro y oscuro, con aprobación del dueño del proyecto.
3. Detenerse y revisar con la imagen de referencia antes de seguir con el resto.

### Incremental Delivery

1. Fase 2 → la app ya cambia de modo y tiene componentes base.
2. US1 → US2 → US3: las pantallas más vistas, aprobadas una por una.
3. US4 → US5 → US7 → US6: navegación, uso diario, validación de los dos modos y lo menos frecuente.
4. Polish: retirar lo provisional, medir y cerrar.

### Notes

- Cada historia se aprueba con capturas en claro y oscuro junto a la imagen de referencia antes de pasar a la siguiente.
- Ninguna tarea agrega funciones: si una pantalla de la referencia tiene algo que Saveria no hace (gráficos, resumen, metas, tarjetas), no se dibuja.
- No hacer commit sin que el usuario lo pida; los commits van sin coautor.
