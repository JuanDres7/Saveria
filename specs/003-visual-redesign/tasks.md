---

description: "Tareas de la feature 003-visual-redesign"
---

# Tasks: Rediseño visual de la app

**Input**: Documentos de diseño en `specs/003-visual-redesign/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/ui-contract.md](contracts/ui-contract.md),
[quickstart.md](quickstart.md) y [docs/mapa-de-la-app.md](../../docs/mapa-de-la-app.md). La constitución v1.2.0 ya
permite las librerías de interfaz. Propuesta visual aprobada: «La hoja de Saveria»
(https://claude.ai/artifact/HeGUmjPATU7j8e3wmoWTfc).

**Tests**: OBLIGATORIAS por la Constitución VIII. Dentro de cada historia, las pruebas se escriben primero y deben
fallar antes de implementar. Toda prueba visual corre en modo claro y en modo oscuro.

**Organization**: Tareas agrupadas por historia de usuario. Solo se toca `apps/mobile` (y `docs/` en el cierre);
`packages/shared`, `apps/api` y `openapi.yaml` quedan igual.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos y sin dependencias pendientes)
- **[Story]**: historia de usuario a la que pertenece (US1…US7)

## Path Conventions

- App: `apps/mobile/src/` (rutas de Expo Router en `apps/mobile/src/app/`), pruebas en `apps/mobile/tests/`
- Tema: `apps/mobile/src/theme/`; piezas compartidas nuevas: `apps/mobile/src/ui/`
- Comandos: Bun (`bun`, `bunx`). Bun no está en el PATH fijo: `export PATH="$HOME/.bun/bin:$PATH"`. Las pruebas de la
  app se corren con `cd apps/mobile && bun run test`.
- Emulador: `saveria_spike`, con `adb` + uiautomator (ayudantes `ui.py` y `launch.sh` del scratchpad). Cambiar de modo:
  `adb shell cmd uimode night yes` / `night no`. Letra al 150 %: `adb shell settings put system font_scale 1.5`
  (volver con `1.0`).
- Colores: solo en `apps/mobile/src/theme/palettes.ts`; ninguna otra pieza lleva `#hex`, `rgb(` ni `rgba(`.
- Dinero (FR-008): gasto con «−» en `text`; ingreso con «+» en `positive`; `negative` solo en saldos negativos y errores.
- Letra (FR-004): `fonts.display` solo en títulos y cifras grandes; el resto, la del sistema.
- Los nombres accesibles y los `testID` que ya usan las pruebas de la 001 y la 002 se conservan. Las únicas pruebas
  existentes que cambian a propósito son las de la tabla «Pruebas existentes que cambian a propósito» de
  `plan.md`; si falla cualquier otra, se corrige el código, no la prueba.
- Sin funciones nuevas (FR-019): no se dibuja «gasto del mes», resumen, gráficos, metas, deudas, conversación con la
  IA ni «Próximos». Del mapa solo se deja la estructura (FR-032).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Medir el punto de partida, instalar las dos librerías y traer la letra

- [X] T001 Medir el punto de partida y guardarlo en `specs/003-visual-redesign/checklists/baseline.md`: correr `bun run test`, `bun run test:sqlite`, `bun run lint` y `bunx tsc --noEmit` en `apps/mobile` y `bun test` en `apps/api` y `packages/shared` (anotar cuántas pruebas pasan); medir el tamaño del paquete con `bunx expo export --platform android --output-dir ../../.scratch-export` y anotar los bytes del `.hbc`; borrar la carpeta de salida
- [X] T002 Instalar las dos librerías en `apps/mobile/package.json`: `bunx expo install react-native-svg` (debe quedar en 15.16.0) y `bun add lucide-react-native`; comprobar con `bunx expo install --check` que no hay versiones fuera de Expo 58 y que `react-native-safe-area-context` y `expo-font` siguen como estaban. Comprobar las condiciones (2) y (3) de la constitución v1.2.0 buscando en el código instalado de `lucide-react-native` y `react-native-svg` que no usan `fetch(`, `XMLHttpRequest` ni `WebSocket`, y anotar el resultado en `checklists/baseline.md`
- [X] T003 [P] Traer la letra de identidad: obtener `BricolageGrotesque_600SemiBold.ttf` y `BricolageGrotesque_700Bold.ttf` del paquete `@expo-google-fonts/bricolage-grotesque` (sin dejarlo como dependencia) y copiarlos junto con su licencia `OFL.txt` a `apps/mobile/assets/fonts/`; anotar en `checklists/baseline.md` el peso de cada archivo y si la letra trae cifras tabulares (si no las trae, la cifra del balance usará la letra del sistema: dejarlo anotado para T013 y T028)
- [X] T004 [P] Preparar Jest para las librerías nuevas en `apps/mobile/package.json` (clave `jest`, `transformIgnorePatterns` si `lucide-react-native` o `react-native-svg` lo piden) y en `apps/mobile/jest.setup.ts`: simular `react-native-svg` (cada elemento se dibuja como un `View` con sus hijos) y `react-native-safe-area-context` con márgenes fijos (`top: 24, bottom: 16`) que las pruebas puedan cambiar
- [X] T005 [P] Crear el ayudante de pruebas `apps/mobile/tests/support/color-scheme.tsx`: `renderInBothModes(ui, check)` simula `useColorScheme` en `light` y en `dark`, ejecuta la comprobación en cada modo y limpia al terminar; `setColorScheme(mode)` lo cambia con la pantalla ya dibujada; `withFontScale(1.5, fn)` simula la letra del sistema al 150 %

**Checkpoint**: las pruebas de la 001 y la 002 siguen en verde con las librerías instaladas.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tema de dos paletas, letra, íconos, piezas compartidas y componentes base. Nada de las historias empieza antes.

### Tests (escribirlas primero; deben fallar)

- [X] T006 [P] Escribir `apps/mobile/tests/theme-contrast.test.ts`: calcula la razón de contraste WCAG sobre `theme/palettes.ts` y exige, en las dos paletas, 4,5 en `text` y `textMuted` sobre `background`, `surface` y `surfaceSoft`; `onPrimary` sobre `primary`; `primary` sobre `background`, `surface` y `sage`; `onHero` y `onHeroMuted` sobre `hero` y `heroShape`; `negative` y `positive` sobre `background`, `surface` y `surfaceSoft`; `warningText` sobre `warningBackground`; `onInverse` sobre `inverse`; y 3,0 en `border` sobre `background` y `surface` y en cada `toneXInk` sobre su `toneX` (FR-029, SC-002)
- [X] T007 [P] Escribir `apps/mobile/tests/theme-tokens.test.ts`: recorre `apps/mobile/src/` y falla si encuentra `#rrggbb`, `#rgb`, `rgb(` o `rgba(` fuera de `theme/palettes.ts` (FR-007, SC-007); comprueba que las paletas clara y oscura tienen exactamente los mismos tokens y que `legacyColors` solo contiene alias de tokens existentes; falla también si algún archivo de `src/` importa `SvgUri` o `SvgCssUri` de `react-native-svg` (únicos componentes que hacen una petición de red: condición (2) de la constitución v1.2.0)
- [X] T008 [P] Escribir `apps/mobile/tests/category-icons.test.ts`: cada `slug` de `CATEGORIES` (`packages/shared/src/catalog/categories.ts`: 18 de gasto y 8 de ingreso), la transferencia y el ajuste de saldo tienen ícono y tono según la tabla de `data-model.md`; cada ícono del mapa existe en `lucide-react-native`; un `slug` desconocido cae en el ícono y el tono neutros (FR-009)
- [X] T009 [P] Escribir `apps/mobile/tests/theme-hook.test.tsx`: `useTheme()` devuelve la paleta clara con `light` o sin modo, y la oscura con `dark`; cambiar el modo con el componente ya dibujado vuelve a dibujarlo sin desmontarlo; `useStyles` memoriza por modo (FR-027, FR-028)
- [X] T010 [P] Escribir `apps/mobile/tests/ui-parts.test.tsx`: `Icon` oculto a lectores de pantalla salvo que sea el único contenido de un control; `CategoryIcon` usa el tono de su categoría; `Leaf` tiene las esquinas 34/12 (variante `balance`) y 20/8 (variante `fab`) en esquinas opuestas, con las nervaduras fuera del orden de foco (FR-031); `Card` es plana y no tocable; `ScreenBackground` deja el contenido dentro de los márgenes del sistema; `BackButton` se llama «Volver», mide ≥ 48 dp y vuelve atrás (FR-016)
- [X] T011 [P] Escribir `apps/mobile/tests/ui-base-components.test.tsx`: `Screen`, `Field`, `PrimaryButton`, `TextButton`, `Banner`, `RadioOption` y `Chip` en los dos modos conservan sus nombres accesibles y roles, tienen objetivo táctil ≥ 48 dp, el botón principal es ancho, el campo con error muestra ícono y texto además del color, los títulos usan `fonts.display` y el texto corrido la letra del sistema (FR-004), y con `withFontScale(1.5)` ningún texto se corta (FR-002, FR-003, FR-023 a FR-026, SC-005)

### Implementation

- [X] T012 Crear `apps/mobile/src/theme/palettes.ts` con el tipo `ThemeColors` y las paletas `lightColors` y `darkColors` con los valores exactos de `data-model.md` (`background`, `surface`, `surfaceSoft`, `sage`, `primary`, `onPrimary`, `hero`, `heroShape`, `onHero`, `onHeroMuted`, `text`, `textMuted`, `border`, `divider`, `disabled`, `negative`, `positive`, `warningBackground`, `warningText`, `inverse`, `onInverse`, `toneSand`, `toneSandInk`, `toneMist`, `toneMistInk`, `toneClay`, `toneClayInk`); el tipo obliga a que las dos paletas tengan los mismos nombres. Incluir `legacyColors` solo con alias (`primarySoft` → `sage`, `textStrong` → `text`, `inverseAccent` → `primary`). Es el único archivo con colores. Pasa T006
- [X] T013 [P] Crear `apps/mobile/src/theme/tokens.ts` con radios (`leaf` 34/12, `leafSmall` 20/8, `sheet` 26 arriba, `card` 24, `control` 16, `pill` 999), espacios (4, 8, 12, 16, 20, 24, 32), `touch` 48, tamaños de ícono (20 en filas, 24 en barra, 23 en el «+»; trazo 1,75 y 2 en el «+»), `fonts.display` (Bricolage Grotesque, pesos 600 y 700), la escala de texto de `data-model.md` y las dos únicas sombras (`heroShadow` y la del «+»)
- [X] T014 Convertir `apps/mobile/src/theme.ts` en `apps/mobile/src/theme/index.ts` (con `git mv`): `useTheme()` (modo desde `useColorScheme()`, `light` si el sistema no informa), `useStyles(factory)` y, mientras se migran las pantallas, la exportación `colors` marcada `@deprecated` armada con `lightColors` más `legacyColors`; los imports `../theme` siguen valiendo. Ajustar a propósito `apps/mobile/tests/us2-history.test.tsx:164` para que lea el color del saldo negativo de `lightColors.negative` (ver `plan.md`). Pasan T007 y T009
- [X] T015 [P] Crear `apps/mobile/src/ui/category-icons.ts` (mapa `slug` → ícono de lucide y tono, según `data-model.md`; transferencia `ArrowLeftRight` y ajuste `Scale` en tono neutro; respaldo neutro) y `apps/mobile/src/ui/CategoryIcon.tsx` (círculo con el fondo del tono y el ícono en su tinta). Pasa T008
- [X] T016 [P] Crear `apps/mobile/src/ui/Icon.tsx`: envuelve un ícono de lucide, importado uno por uno, con color de un token del tema (por defecto `text`), tamaño y trazo de `tokens.ts` y oculto a lectores de pantalla salvo que se indique lo contrario
- [X] T017 [P] Crear `apps/mobile/src/ui/Leaf.tsx`: vista con forma de hoja en dos variantes (`balance`: fondo `hero`, esquinas 34/12, sombra `heroShadow` y nervaduras `heroShape` dibujadas con `react-native-svg` detrás del contenido; `fab`: fondo `primary`, esquinas 20/8 y su sombra); las nervaduras son estáticas, memorizadas y quedan fuera del orden de foco
- [X] T018 [P] Crear `apps/mobile/src/ui/Card.tsx` (tarjeta plana con radio `card`, fondo `surface` o `surfaceSoft`, no tocable) y `apps/mobile/src/ui/BackButton.tsx` (círculo `surfaceSoft` con `ChevronLeft`, `accessibilityLabel="Volver"`, ≥ 48 dp, `router.back()` por defecto)
- [X] T019 [P] Crear `apps/mobile/src/ui/ScreenBackground.tsx`: fondo `background` y una forma orgánica `sage` en la esquina superior dibujada con `react-native-svg`, estática y fuera del orden de foco; el contenido queda dentro de los márgenes de `useSafeAreaInsets()`. Pasa T010 junto con T015 a T018
- [X] T020 Hacer que `apps/mobile/src/app/_layout.tsx` siga el modo: `StatusBar` de `expo-status-bar` con el estilo del tema y `SystemUI.setBackgroundColorAsync` de `expo-system-ui` con `background`, para que no destelle en blanco al abrir ni al cambiar de modo
- [X] T021 [P] Actualizar `apps/mobile/app.json`: pantalla de arranque crema `#F6F3EA` en claro y `#14180F` en oscuro (variante `dark` del plugin `expo-splash-screen`), fondo del ícono adaptable en crema, y el plugin `expo-font` con los dos archivos de `assets/fonts/` como una sola familia `BricolageGrotesque` con pesos 600 y 700 (se incrustan al compilar; no se usa `useFonts`). `userInterfaceStyle` sigue en `automatic`. Estos colores viven en la configuración de Expo, fuera de `src/`, porque el sistema los lee antes de que arranque la app
- [X] T022 Restyle de los componentes base en `apps/mobile/src/features/auth/components.tsx` (`Screen` con `ScreenBackground` y márgenes del sistema, título en `fonts.display`, `Field`, `PrimaryButton` ancho con ícono opcional, `TextButton`, `Banner`, `RadioOption`, `styles` y el pie fijo de los formularios) usando `useTheme`/`useStyles`; mismos nombres accesibles. Pasa T011 para esas piezas
- [X] T023 [P] Restyle de `apps/mobile/src/features/transactions/Chip.tsx` en forma de píldora (`pill`), con ícono opcional a la izquierda: elegido en `primary` con `onPrimary`, no elegido en `surfaceSoft`, área de toque ≥ 48 dp. Pasa T011
- [X] T024 Reconstruir e instalar la app de desarrollo en el emulador, porque `react-native-svg`, la letra incrustada y la pantalla de arranque son cambios nativos: `cd apps/mobile && bunx expo run:android`; abrir con `launch.sh` y comprobar en claro y en oscuro que la bienvenida usa la letra de identidad en el título, que no hay destello blanco ni azul al abrir, y registrar el resultado en `specs/003-visual-redesign/checklists/visual-review.md`

**Checkpoint**: T006 a T011 en verde, `bun run test`, `bun run lint` y `bunx tsc --noEmit` sin errores, la app abre en el emulador en los dos modos. Las historias pueden empezar.

---

## Phase 3: User Story 1 - Inicio con identidad propia (Priority: P1) 🎯 MVP

**Goal**: Inicio con saludo, tarjeta de balance en forma de hoja, cuentas en fila y últimos movimientos sobre una sola lámina.

**Independent Test**: con varias cuentas y movimientos, Inicio muestra todo con el estilo nuevo y los mismos números que antes.

### Tests for User Story 1 (escribirlas primero; deben fallar)

- [X] T025 [P] [US1] Escribir `apps/mobile/tests/balance-card.test.ts` para `selectBalanceCard(summary, defaultAccount)`: devuelve el total y la moneda principal cuando todas las cuentas activas están en la moneda principal; si no, el saldo de la cuenta por defecto con su nombre y la señal de que hay otras monedas, sin mezclar; las cuentas archivadas no suman; sin cuentas locales usa la cuenta por defecto del perfil (FR-012, escenario 1.2)
- [X] T026 [P] [US1] Escribir `apps/mobile/tests/us1-home-visual.test.tsx` con `renderInBothModes`: saludo «Hola, {nombre}» en `fonts.display`; tarjeta de balance con forma de hoja, su etiqueta («Tu balance total» o «Saldo de {cuenta}») y «Transferir» solo con dos cuentas activas; cuentas en una fila horizontal con su saldo en su moneda y el negativo en `negative` con signo; movimientos con `CategoryIcon`, título, cuenta y monto (gasto «−» en `text`, ingreso «+» en `positive`) agrupados por día (FR-008, FR-010); sin movimientos y con moneda principal, el mensaje provisional «Aún no tienes movimientos. Registra el primero con «Registrar movimiento».» (la historia 4 lo cambia por «…Toca el botón + para registrar el primero.»); sin conexión, los mismos datos; los bloques aparecen en el orden del mapa (saludo, aviso de correo, balance, cuentas, movimientos; cada bloque con su `testID` `home-block-…`); un nombre de cuenta de 40 caracteres, un monto de 12 dígitos y 20 cuentas activas no cortan ni rompen la pantalla; los números son los mismos que con la pantalla anterior (escenarios 1.1 a 1.6)

### Implementation for User Story 1

- [X] T027 [US1] Crear `apps/mobile/src/features/accounts/balance-card.ts` con `selectBalanceCard` usando `summarizeAccounts` de `features/transactions/ledger.ts`. Pasa T025
- [X] T028 [P] [US1] Crear `apps/mobile/src/features/accounts/BalanceCard.tsx`: `Leaf` variante `balance` con la etiqueta, la cifra grande en `fonts.display` (o la del sistema si T003 anotó que no hay cifras tabulares) que reduce su tamaño antes de cortarse, la moneda al lado, «En N cuentas» y el botón «Transferir» (`accessibilityRole="button"`) cuando hay dos cuentas activas
- [X] T029 [P] [US1] Crear `apps/mobile/src/features/accounts/AccountTile.tsx` (ícono del tipo de cuenta, nombre y saldo en su moneda, negativo en `negative` con signo, `accessibilityLabel` «Saldo de {nombre}» como hoy; no se toca, igual que antes) y `AccountsRow` (fila horizontal que se desliza), ambos en el mismo archivo
- [X] T030 [US1] Restyle de `apps/mobile/src/features/transactions/RecentList.tsx`: `TransactionRow` como fila simple con `CategoryIcon`, título, cuenta y monto (gasto «−» en `text`, ingreso «+» en `positive`, transferencia y ajuste neutros) y una línea `divider` entre filas; `DayHeader`; `DaySections` sin tarjeta por fila; quitar la constante `NEGATIVE_COLOR` y actualizar sus importaciones en `apps/mobile/src/app/(app)/home.tsx` y `apps/mobile/src/features/accounts/AccountList.tsx`
- [X] T031 [US1] Rediseñar `apps/mobile/src/app/(app)/home.tsx` sobre `apps/mobile/src/features/home/blocks.tsx`: una lista ordenada de bloques (saludo, `VerifyBanner`, `BalanceCard`, cuentas, últimos movimientos con «Ver todo») dentro de `ScreenBackground`, con cuentas y movimientos sobre una sola lámina `surface` de radio `sheet`; el estado vacío con su mensaje. Mientras no exista la barra (US4), conserva como provisionales el botón «Registrar movimiento» y los enlaces «Cuentas de dinero», «Configuración» y «Cerrar sesión» al pie (bloques `home-provisional-…`). Pasa T026
- [X] T032 [US1] Verificar Inicio en el emulador en modo claro y oscuro con `qs002.final@mail.com` / `clave1234` (varias cuentas y movimientos) y con una cuenta nueva (estado vacío); capturas junto a `inspiracion/Inspiracion.png` y a la maqueta en `checklists/visual-review.md`; pedir la aprobación del dueño del proyecto (SC-008) antes de seguir

**Checkpoint**: Inicio funciona y se aprueba por sí solo. Esto es el MVP del rediseño.

---

## Phase 4: User Story 2 - Registrar un movimiento con el nuevo estilo (Priority: P1)

**Goal**: Registrar, editar y transferir con la identidad nueva, sin pasos extra ni perder el botón de guardar.

**Independent Test**: registrar un gasto típico y contar los toques (máx. 3 más el monto); el formulario se ve igual de claro con teclado abierto.

### Tests for User Story 2 (escribirlas primero; deben fallar)

- [X] T033 [P] [US2] Escribir `apps/mobile/tests/us2-record-visual.test.tsx` con `renderInBothModes`: cada categoría es un chip con su ícono y su nombre (2.1); escribir el monto, tocar la categoría y guardar registra el gasto con cuenta y fecha por defecto, en máx. 3 toques más el monto (2.2); al tocar una categoría se cierra el teclado y «Guardar» queda visible en el pie (2.3); sin monto o sin categoría el error se ve junto al campo con ícono y texto (2.4); editar un movimiento y transferir usan los mismos campos, chips y botones (2.5); las tres pantallas tienen `BackButton` (FR-016); con `withFontScale(1.5)` los chips de nombre largo («Restaurantes y domicilios») no se cortan

### Implementation for User Story 2

- [X] T034 [US2] Restyle de `apps/mobile/src/features/transactions/TransactionForm.tsx`: selector «Gasto | Ingreso», monto grande en `fonts.display`, categorías como chips con ícono, cuenta y fecha en chips, y botón «Guardar» fijo en el pie fuera del `ScrollView` sumando el margen inferior del sistema; conserva `Keyboard.dismiss()` al tocar categoría. Pasa T033
- [X] T035 [P] [US2] Restyle de `apps/mobile/src/features/transactions/TransferFormView.tsx` con los mismos campos, chips «Hacia {cuenta}» y botón de pie
- [X] T036 [P] [US2] Crear `apps/mobile/src/features/transactions/form-parts.tsx` con `RegisterHeader` (volver + título; es el lugar donde el mapa pondrá el selector «Contar | A mano», hoy no muestra nada más), `FormScreen` (fondo, encabezado, contenido que se desplaza y pie fijo que sube con el teclado), `SegmentedControl`, `AmountField` y `FormLabel` y usarlo en `apps/mobile/src/app/(app)/transactions/new.tsx`; ajustar `apps/mobile/src/app/(app)/transactions/[id].tsx` y `apps/mobile/src/app/(app)/transfer.tsx` a `BackButton` y a los márgenes del sistema, sin cambiar su lógica
- [X] T037 [US2] Verificar en el emulador, en claro y oscuro: registrar un gasto (contar toques, menos de 5 s, y que «Guardar» no quede bajo el teclado ni la barra de gestos), editar, transferir y borrar con «Deshacer»; con 5000 movimientos sembrados (`EXPO_PUBLIC_SEED_TRANSACTIONS=5000`) comprobar que registrar sigue en ≤ 1,5 s como en la 002; capturas y aprobación en `checklists/visual-review.md`

**Checkpoint**: Inicio y Registrar funcionan y se aprueban por separado.

---

## Phase 5: User Story 3 - Entrar y empezar con la misma identidad (Priority: P1)

**Goal**: Bienvenida, registro, inicio de sesión, recuperar contraseña y los 5 pasos del onboarding con la identidad nueva.

**Independent Test**: recorrer sin sesión desde la bienvenida hasta terminar el onboarding; el comportamiento no cambia.

### Tests for User Story 3 (escribirlas primero; deben fallar)

- [X] T038 [P] [US3] Escribir `apps/mobile/tests/us3-auth-visual.test.tsx` con `renderInBothModes`: la bienvenida con la parte superior en forma de hoja, la marca, el texto actual («Bienvenido a Saveria», «Cuéntale a Saveria tus gastos e ingresos con tus palabras.») y las acciones «Crear cuenta» y «Ya tengo cuenta» (3.1); registro, inicio de sesión y recuperar contraseña con los mismos campos, errores y botones (3.2); cada uno de los 5 pasos del onboarding muestra su avance («Paso X de 5») y una sola acción principal (3.3); la casilla de la política de datos se lee marcada y sin marcar, con ícono además del color (3.4); los nombres accesibles y los `testID` de `us1-auth`, `us2-onboarding` y `us5-session` siguen valiendo

### Implementation for User Story 3

- [X] T039 [US3] Rediseñar `apps/mobile/src/app/(auth)/welcome.tsx`: parte superior `hero` con forma de hoja y nervaduras, la marca (`Leaf` + «Saveria»), el título y el texto actuales, «Crear cuenta» como botón principal y «Ya tengo cuenta» como secundario
- [X] T040 [P] [US3] Restyle de `apps/mobile/src/app/(auth)/register.tsx`, `apps/mobile/src/app/(auth)/login.tsx`, `apps/mobile/src/app/(auth)/forgot-password.tsx` y `apps/mobile/src/app/(auth)/_layout.tsx`, incluida la casilla de la política de datos y `BackButton`
- [X] T041 [P] [US3] Crear `apps/mobile/src/features/onboarding/StepProgress.tsx` (indicador de avance de 5 pasos) y restyle de las cinco pantallas `apps/mobile/src/app/(onboarding)/country.tsx`, `currency.tsx`, `city.tsx`, `ai-name.tsx`, `ai-mode.tsx` y de `apps/mobile/src/app/(onboarding)/_layout.tsx`, con `RadioOption` y el botón principal en el pie
- [X] T042 [US3] Verificar en el emulador, en claro y oscuro, el recorrido completo sin sesión con una cuenta nueva (bienvenida → crear cuenta → 5 pasos → Inicio) y un inicio de sesión con «olvidé mi contraseña»; capturas y aprobación en `checklists/visual-review.md`

**Checkpoint**: las tres historias P1 se aprueban. La app ya tiene su identidad en las pantallas más vistas.

---

## Phase 6: User Story 4 - Navegar con una barra inferior (Priority: P2)

**Goal**: Barra de cuatro secciones con la actual marcada y el botón «+» central para registrar, sin mover rutas.

**Independent Test**: desde cualquier sección principal se llega a las demás con un toque, el «+» abre Registrar y la sección actual se ve marcada.

### Tests for User Story 4 (escribirlas primero; deben fallar)

- [ ] T043 [P] [US4] Escribir `apps/mobile/tests/us4-tabbar.test.tsx` con `renderInBothModes`: cuatro secciones con ícono y nombre, la actual marcada (4.1); tocar otra sección llega a ella y al volver conserva donde estaba (4.2); la barra y el «+» no aparecen en formularios ni detalle (registrar, editar, transferir, ajustar saldo, nueva cuenta) y «Guardar» sigue a la vista (4.3); funciona sin conexión (4.4); no aparece sin sesión, en el onboarding ni en `verify-email-gate` (4.5); el «+» es un botón llamado «Registrar movimiento» que abre `/transactions/new` desde las cuatro secciones (4.6); sin moneda principal el «+» no se dibuja y con moneda principal sí (4.7; reemplaza las dos comprobaciones de `us2-onboarding.test.tsx`); en una pantalla no hay dos controles llamados «Registrar movimiento»; la barra se arma desde la lista `TAB_ITEMS` y muestra el punto de aviso de una sección cuando se le pide (FR-032); suma el margen inferior del sistema; cada destino y el «+» miden ≥ 48 dp; «Cerrar sesión» está en Ajustes y Ajustes no tiene «Volver»
- [ ] T044 [P] [US4] Actualizar `apps/mobile/tests/guards.test.tsx` para la estructura con barra (las mismas rutas siguen protegidas: `home`, `transactions/*`, `transfer`, `accounts/*`, `settings/*`; `verify-email-gate` sigue siendo la única pantalla del grupo de verificación) y ajustar a propósito `apps/mobile/tests/us2-onboarding.test.tsx` líneas 347 y 357: la regla de «Registrar movimiento» pasa a T043 y en Inicio se conserva la comprobación de «Efectivo» y su saldo

### Implementation for User Story 4

- [ ] T045 [US4] Crear `apps/mobile/src/ui/TabBar.tsx`: se arma desde la lista `TAB_ITEMS` (ícono, nombre, ruta y punto de aviso opcional; hoy Inicio `House`, Movimientos `ReceiptText`, Cuentas `Wallet`, Ajustes `Settings`), con la actual en fondo `sage` y texto en negrita, `accessibilityRole="tab"` y estado seleccionado, columna central de ancho fijo para el «+» (`Leaf` variante `fab`, botón «Registrar movimiento», solo si hay moneda principal), y el margen inferior del sistema sumado a su alto
- [ ] T046 [US4] Cambiar `apps/mobile/src/app/(app)/_layout.tsx` de `Stack` a `Tabs` de expo-router con `TabBar` propia: pestañas `home`, `transactions/index`, `accounts/index`, `settings/index`; el resto de las rutas declaradas pero ocultas de la barra; la barra solo se pinta cuando la ruta actual es una de las cuatro; mantener los guardias de `routeGroupFor` (confirmar si `Tabs.Protected` existe en expo-router ~58; si no, redirigir en el propio layout) y `UndoSnackbar` fuera de las pantallas, por encima de la barra y del «+». Pasan T043 y T044
- [ ] T047 [US4] Retirar lo provisional de `apps/mobile/src/features/home/blocks.tsx` (botón «Registrar movimiento» y enlaces «Cuentas de dinero», «Configuración» y «Cerrar sesión») y poner el mensaje definitivo del estado vacío (`Aún no tienes movimientos. Toca el botón + para registrar el primero.`, también en el texto de `us1-home-visual.test.tsx`); en `apps/mobile/src/app/(app)/settings/index.tsx` agregar «Cerrar sesión» con su misma acción (`authService.logout()`) y quitar el botón «Volver» (ahora es una sección de la barra); en `apps/mobile/src/app/(app)/accounts/[id].tsx` agregar el acceso «Registrar movimiento» y conservar «Transferir desde esta cuenta»
- [ ] T048 [US4] Verificar en el emulador, en claro y oscuro: cambiar de sección, el «+» desde las cuatro, volver con «atrás» (dos «atrás» desde Inicio salen de la app; «atrás» desde un formulario vuelve a su sección), barra oculta en formularios, sin conexión, con navegación por gestos y por tres botones, en un perfil de pantalla pequeña y otro grande (`adb shell wm size`), y con `font_scale 1.5` que el «+» no tape ningún nombre; capturas y aprobación en `checklists/visual-review.md`

**Checkpoint**: la navegación nueva funciona sin romper las rutas ni las demás pruebas.

---

## Phase 7: User Story 5 - Historial y cuentas con el nuevo estilo (Priority: P2)

**Goal**: Historial con filtros en chips y lista por día; cuentas, detalle, archivadas, nueva y ajustar saldo con el mismo estilo.

**Independent Test**: recorrer historial, lista de cuentas, nueva cuenta, detalle, archivadas y ajustar saldo.

### Tests for User Story 5 (escribirlas primero; deben fallar)

- [ ] T049 [P] [US5] Escribir `apps/mobile/tests/us5-lists-visual.test.tsx` con `renderInBothModes`: el historial agrupa por día con ícono, título, cuenta y monto con signo, y los filtros existentes («Todas» y uno por cuenta) se ven como chips (5.1); cada cuenta muestra su nombre, tipo y saldo en su moneda, con la marcada por defecto señalada con texto (5.2); archivar, reactivar, ajustar saldo y marcar por defecto conservan su comportamiento y sus avisos (5.3); un movimiento o cuenta rechazado por el servidor muestra el aviso con ícono, texto y acción de corregir (5.4); la lista larga sigue cargando por páginas (5.5); el historial vacío muestra «Todavía no hay movimientos.» y «Cuando registres uno, aparecerá aquí.», y archivadas vacía «No tienes cuentas archivadas.» (FR-013); un nombre de cuenta de 40 caracteres y 20 cuentas no rompen la lista; detalle, nueva, archivadas y ajustar tienen `BackButton`

### Implementation for User Story 5

- [ ] T050 [US5] Restyle de `apps/mobile/src/app/(app)/transactions/index.tsx` como pantalla contenedora (título, filtros en `Chip`, y la lista como parte propia `apps/mobile/src/features/transactions/HistoryList.tsx` con `DaySections`, la misma paginación y el estado vacío), sobre la lámina `surface`; sin tarjeta de resumen ni totales nuevos (FR-019). Pasa T049 para el historial
- [ ] T051 [P] [US5] Restyle de `apps/mobile/src/features/accounts/AccountList.tsx` (filas con ícono del tipo, nombre, «Por defecto» y saldo) y de `apps/mobile/src/app/(app)/accounts/index.tsx` como pantalla contenedora con la lista como parte; restyle de `apps/mobile/src/features/accounts/AccountFields.tsx` y de `apps/mobile/src/app/(app)/accounts/new.tsx`
- [ ] T052 [P] [US5] Restyle de `apps/mobile/src/app/(app)/accounts/[id].tsx`, `apps/mobile/src/app/(app)/accounts/archived.tsx` (con su estado vacío) y `apps/mobile/src/app/(app)/accounts/[id]/adjust.tsx` (la vista previa de la diferencia con los mismos números), con `BackButton` y los avisos de rechazo del servidor legibles en los dos modos
- [ ] T053 [US5] Verificar en el emulador, en claro y oscuro, con 5000 movimientos sembrados: desplazar el historial sin trabarse (≤ 8 ms / 11 ms por cuadro, medido como en la 002), crear, archivar y reactivar una cuenta y ajustar un saldo; capturas y aprobación en `checklists/visual-review.md`

**Checkpoint**: todas las pantallas de uso diario tienen la identidad nueva.

---

## Phase 8: User Story 7 - Modo claro y modo oscuro (Priority: P2)

**Goal**: Las dos variantes se ven bien en todas las pantallas ya rediseñadas y el cambio de modo con la app abierta no pierde nada. La base (paletas, `useTheme`, arranque) ya está en la fase 2; esta fase la comprueba de punta a punta (las pantallas de US6 se revisan en su propia fase).

**Independent Test**: recorrer las pantallas con el teléfono en modo claro y en oscuro y cambiar de modo con un formulario a medias.

### Tests for User Story 7 (escribirlas primero; deben fallar)

- [ ] T054 [P] [US7] Escribir `apps/mobile/tests/us7-modes.test.tsx`: en `light` y en `dark`, Inicio, Registrar, Historial, Cuentas y la bienvenida se dibujan sin errores y con colores solo del tema (7.1, 7.2); cambiar el modo con «Registrar movimiento» abierto y un monto escrito mantiene la pantalla, el monto y la categoría elegida (7.3, FR-030); ingresos en `positive`, saldos negativos en `negative` y gastos en `text` con su signo en cada modo (7.4); avisos, lámina, chips y campos distinguibles del fondo (7.5)

### Implementation for User Story 7

- [ ] T055 [US7] Corregir lo que T054 y el recorrido revelen en `apps/mobile/src/theme/palettes.ts` y en las piezas afectadas (solo ajustes de tokens o de uso del tema, sin colores sueltos)
- [ ] T056 [US7] Recorrer en el emulador las pantallas de US1 a US5 en modo oscuro y en claro; con un formulario a medias correr `adb shell cmd uimode night yes` y `night no` y comprobar que sigue en la misma pantalla con lo escrito (7.3); abrir la app en frío en oscuro y comprobar que no destella en blanco; poner `font_scale 1.5` y comprobar que nada se corta ni se pierde ningún botón (SC-005); capturas y aprobación en `checklists/visual-review.md`

**Checkpoint**: claro y oscuro validados en todo lo hecho hasta aquí.

---

## Phase 9: User Story 6 - Configuración y avisos coherentes (Priority: P3)

**Goal**: Configuración, cambiar contraseña, borrar cuenta, bloqueo de verificación y avisos con la misma identidad y un tono claro en acciones delicadas.

**Independent Test**: recorrer Configuración y sus pantallas, el bloqueo de verificación y los avisos.

### Tests for User Story 6 (escribirlas primero; deben fallar)

- [ ] T057 [P] [US6] Escribir `apps/mobile/tests/us6-settings-visual.test.tsx` con `renderInBothModes`: Configuración agrupa sus opciones en grupos con ícono (6.1); los textos de borrar la cuenta, borrar un movimiento y cerrar sesión con cambios pendientes siguen siendo inequívocos, sin tono motivador (6.2, FR-018); el aviso «Movimiento borrado · Deshacer» y el de correo sin verificar son legibles, y «Deshacer» dura los mismos 6 s y queda por encima de la barra (6.3); el bloqueo por correo sin verificar conserva su comportamiento y sus acciones (6.4); cambiar contraseña y borrar cuenta tienen `BackButton`

### Implementation for User Story 6

- [ ] T058 [P] [US6] Crear `apps/mobile/src/features/settings/SettingsGroup.tsx` (grupo con título y filas con `Icon`) y restyle de `apps/mobile/src/app/(app)/settings/index.tsx` por grupos, de `apps/mobile/src/app/(app)/settings/change-password.tsx` y de `apps/mobile/src/app/(app)/settings/delete-account.tsx` (texto definitivo e inequívoco), con `BackButton` en las dos últimas
- [ ] T059 [P] [US6] Restyle de `apps/mobile/src/app/(app)/verify-email-gate.tsx`, `apps/mobile/src/features/verification/VerifyBanner.tsx` (ícono `Mail`) y `apps/mobile/src/features/transactions/UndoSnackbar.tsx` (colores `inverse`/`onInverse`, por encima de la barra y del «+» con el margen del sistema, misma duración de 6 s)
- [ ] T060 [US6] Verificar en el emulador, en claro y oscuro: Configuración, cambiar contraseña, borrar cuenta (sin confirmar), bloqueo de verificación (cuenta sin verificar), aviso «Deshacer» y el aviso de que no se pudo guardar; capturas y aprobación en `checklists/visual-review.md`

**Checkpoint**: las 23 pantallas tienen la identidad nueva.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Cierre, limpieza del tema y registro de resultados

- [ ] T061 Retirar la exportación `colors` `@deprecated` de `apps/mobile/src/theme/index.ts` y `legacyColors` de `apps/mobile/src/theme/palettes.ts`; reemplazar los usos que queden por `useTheme()`; agregar a `apps/mobile/tests/theme-tokens.test.ts` que ningún archivo de `src/` importa `colors` de `../theme`
- [ ] T062 Recorrer completo `quickstart.md` en el emulador, en claro y en oscuro, y registrar el resultado en `specs/003-visual-redesign/checklists/quickstart-run.md`, incluidos los pasos de pantallas de otro tamaño, letra al 150 % y sin conexión
- [ ] T063 Medir y registrar en `checklists/quickstart-run.md`: registrar un gasto (máx. 3 toques más el monto, menos de 5 s, y ≤ 1,5 s como en la 002), desplazar 5000 movimientos (≤ 8 ms / 11 ms por cuadro) y el tamaño del paquete frente al de T001 (anotar la diferencia; si crece de forma desproporcionada, importar los íconos por archivo)
- [ ] T064 [P] Revisar los registros de la app y de la API durante el recorrido: sin montos, correos ni tokens (misma comprobación de la 001 y la 002); anotar el resultado en `checklists/quickstart-run.md`
- [ ] T065 [P] Actualizar `README.md` (sección de la app: tema claro/oscuro, letra, íconos y cómo cambiar de modo en el emulador), marcar en `docs/mapa-de-la-app.md` qué estructura quedó lista y revisar `specs/003-visual-redesign/checklists/requirements.md`
- [ ] T066 Correr todas las pruebas y comprobaciones (`bun run test`, `bun run test:sqlite`, `bun run lint`, `bunx tsc --noEmit` en `apps/mobile`; `bun test` en `apps/api` y `packages/shared`), confirmar que no hay menos pruebas que en `baseline.md` (salvo las dos comprobaciones movidas a `us4-tabbar.test.tsx`) y marcar todas las tareas
- [ ] T067 Actualizar la memoria del proyecto (`project-workflow-and-git.md`) con el estado de la 003 y dejar la rama lista para su PR a `develop` (sin abrirlo hasta que el usuario lo pida)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup y bloquea todas las historias.
- **US1, US2, US3 (P1)**: dependen de la fase 2; entre sí son independientes, pero se hacen en este orden para ir aprobando de a un grupo de pantallas (SC-008).
- **US4 (P2)**: depende de US1 (retira lo provisional de Inicio) y de la fase 2.
- **US5 (P2)**: depende de la fase 2 y de `RecentList` de US1.
- **US7 (P2)**: depende de que existan las pantallas de US1 a US5 para recorrerlas.
- **US6 (P3)**: depende de la fase 2 y de US4 (el aviso «Deshacer» va sobre la barra y «Cerrar sesión» ya está en Ajustes).
- **Polish (Phase 10)**: depende de todas las historias; retirar `colors` (T061) solo cuando ninguna pantalla lo use.

### Within Each User Story

- Las pruebas se escriben primero y deben fallar.
- Piezas compartidas antes que las pantallas que las usan.
- La verificación en el emulador (y la aprobación) cierra cada historia.

### Parallel Opportunities

- Fase 1: T003, T004 y T005 en paralelo después de T002.
- Fase 2: T006 a T011 (pruebas) en paralelo; T013, T015 a T019, T021 y T023 en paralelo después de T012.
- US1: T025 y T026 en paralelo; T028 y T029 en paralelo.
- US2: T035 y T036 en paralelo. US3: T040 y T041 en paralelo. US4: T043 y T044 en paralelo. US5: T051 y T052 en paralelo. US6: T058 y T059 en paralelo.
- Las historias no se hacen en paralelo entre sí por una sola persona, pero cada una podría asignarse por separado.

---

## Parallel Example: Phase 2 (pruebas)

```text
T006 theme-contrast.test.ts        T007 theme-tokens.test.ts       T008 category-icons.test.ts
T009 theme-hook.test.tsx           T010 ui-parts.test.tsx          T011 ui-base-components.test.tsx
```

---

## Implementation Strategy

### MVP First (US1)

1. Setup + Foundational (T001–T024): tema de dos paletas, letra, íconos, forma de hoja, componentes base y arranque.
2. US1 Inicio (T025–T032): primera pantalla completa en claro y oscuro, con aprobación del dueño del proyecto.
3. Detenerse y revisar con la maqueta y la imagen de referencia antes de seguir con el resto.

### Incremental Delivery

1. Fase 2 → la app ya cambia de modo y tiene componentes base.
2. US1 → US2 → US3: las pantallas más vistas, aprobadas una por una.
3. US4 → US5 → US7 → US6: navegación con el «+», uso diario, validación de los dos modos y lo menos frecuente.
4. Polish: retirar lo provisional, medir y cerrar.

### Notes

- Cada historia se aprueba con capturas en claro y oscuro junto a la maqueta antes de pasar a la siguiente.
- Ninguna tarea agrega funciones: del mapa solo se deja la estructura (barra como lista, Inicio por bloques, `RegisterHeader`, pantallas contenedoras, `SettingsGroup`).
- No hacer commit sin que el usuario lo pida; los commits van sin coautor.
