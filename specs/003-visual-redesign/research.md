# Investigación: Rediseño visual de la app

**Fecha**: 2026-11-09 (revisado con «La hoja de Saveria») | **Plan**: [plan.md](plan.md)

No quedaron marcadores `NEEDS CLARIFICATION`. Lo que sigue registra lo que se verificó y las decisiones.

## Hechos verificados en el repositorio

- `node_modules` no trae `@expo/vector-icons`, `react-native-svg` ni `expo-linear-gradient`. Hoy la app no dibuja ningún ícono.
- `expo/bundledNativeModules.json` (Expo 58) fija `react-native-svg` en **15.16.0**. `react-native-safe-area-context` ya está en
  `package.json` (`~5.10.1`) pero ninguna pantalla la usa.
- `lucide-react-native` 1.70.0 declara como peer `react-native-svg` `^12 || … || ^15` y `react` hasta la 19, y no tiene
  dependencias propias: es compatible con React 19.3 y con la 15.16.0 de Expo.
- `@expo-google-fonts/bricolage-grotesque` 0.4.1: sin dependencias, licencia MIT (código) y OFL-1.1 (la letra).
- El plugin de `expo-font` instalado (`expo-font/plugin`) admite la opción `fonts` para Android: incrusta los archivos `.ttf`
  al compilar, sin carga en ejecución.
- `apps/mobile/app.json` ya trae `"userInterfaceStyle": "automatic"`, `reactCompiler: true`. La pantalla de arranque tiene fondo
  azul `#208AEF` y el ícono adaptable `#E6F4FE`, ambos de la plantilla.
- Solo 11 archivos importan `theme`, hay 15 `StyleSheet.create` y unos 34 usos de `colors.`; el rediseño es abarcable sin
  tocar la lógica. El historial ya usa `SectionList`.
- El catálogo tiene 18 categorías de gasto y 8 de ingreso con `slug` estable (`packages/shared/src/catalog/categories.ts`).
- Pruebas que tocan lo que cambia: `tests/us2-history.test.tsx:164` comprueba el color del saldo negativo de una cuenta
  (`#b91c1c`); `tests/us2-onboarding.test.tsx:347 y 357` comprueban que «Registrar movimiento» aparece o no en Inicio según la
  moneda principal.

## Decisiones

### D1. Íconos: `lucide-react-native` sobre `react-native-svg`

- **Decisión**: `lucide-react-native` para todos los íconos y `react-native-svg` para dibujarlos y para las formas decorativas
  (la forma orgánica de fondo y las nervaduras de la hoja).
- **Razón**: la referencia usa íconos de línea fina y lucide es exactamente ese estilo, con trazo ajustable; cubre las 26
  categorías con un solo estilo; se importa ícono por ícono; es compatible con la versión de Expo.
- **Alternativas**: `@expo/vector-icons` (Feather es de línea pero tiene pocos íconos; las otras familias son rellenas o mezclan
  estilos); dibujar los íconos a mano (trabajo y deuda propios).

### D2. Modo claro y oscuro: `useColorScheme` + dos paletas

- **Decisión**: el tema se resuelve con `useColorScheme()` de React Native y un hook `useTheme()`. Cambia solo cuando cambia el
  modo del teléfono; no hay interruptor propio ni se guarda nada.
- **Razón**: `userInterfaceStyle: "automatic"` ya está; sigue lo que el usuario ya eligió y elimina estado y pantallas nuevas.
- **Alternativas**: interruptor propio en Ajustes (fuera de alcance, FR-028); una librería de temas (innecesaria).

### D3. Paleta de «La hoja de Saveria»

Valores y contrastes completos en [data-model.md](data-model.md); maqueta aprobada en
https://claude.ai/artifact/HeGUmjPATU7j8e3wmoWTfc.

- **Claro**: crema `#F6F3EA`, verde musgo `#3F4A28` para la acción principal y para la tarjeta de balance, texto `#1F2616`.
- **Oscuro**: verde casi negro `#14180F`; el botón principal pasa a oliva claro `#B9C78C` con texto oscuro (9,2:1) y la tarjeta
  de balance a `#2C3720`.
- **Gastos sin alarma**: el monto de un gasto va en el color del texto con signo «−»; verde con «+» para ingresos; el rojo
  ladrillo (`#A63A24` claro, `#F0A493` oscuro) queda solo para saldos negativos y errores. Una lista llena de rojo se lee como si
  todo estuviera mal. Esto cambia lo que decía la spec original (FR-008), ya reflejado en la spec.
- **Cuatro tonos de categoría** (arena, niebla, arcilla y el verde salvia base) más un neutro; agrupan las categorías por tipo de
  gasto para que la lista se recorra más rápido. Mapa en `data-model.md`.
- **Resultado**: todos los pares de texto cumplen 4,5:1 y los bordes de campo y las tintas de ícono 3:1 en los dos modos.
- Se retira el oliva medio `#8F9B6B`: las formas de fondo usan `sage` y la hoja de la tarjeta `heroShape`.

### D4. Tipografía: del sistema para el texto, una letra de identidad para lo grande

- **Decisión**: texto corrido, campos, filas y montos de listas con la letra del sistema (Roboto en Android). Títulos, subtítulos y
  cifras grandes con **Bricolage Grotesque** en dos pesos (SemiBold y Bold).
- **Razón**: una letra con carácter solo en lo grande da identidad sin cargar cada pantalla; es algo angosta, así que caben
  montos largos en pesos sin achicarse. Los montos de las listas se quedan en la del sistema para que las cifras alineen.
- **Cómo se incluye** (sin parpadeo y sin red): los dos `.ttf` (licencia OFL) se copian a `apps/mobile/assets/fonts/` desde el
  paquete `@expo-google-fonts/bricolage-grotesque` y se incrustan al compilar con la opción `fonts` del plugin de `expo-font`. No
  hay `useFonts` en ejecución, así que no se muestra otra letra mientras carga. Si faltaran, la app usa la del sistema.
- **Se comprueba al implementar**: que la letra tenga cifras tabulares; si no, la cifra del balance usa la del sistema.
- **Alternativas**: solo la del sistema (más liviano, pero sin identidad en lo grande); cargar la letra con `useFonts` en
  ejecución (puede mostrar la letra de respaldo un instante); una letra variable (pesa más y Android no la maneja bien).
- **Constitución v1.2.0**: es una librería de interfaz sin red, que funciona sin conexión y se justifica en *Complexity Tracking*.

### D5. Barra inferior: barra propia bajo la pila de pantallas, con botón «+»

- **Decisión (ajustada al implementar la historia 4)**: `(app)/_layout.tsx` **sigue con `Stack`** y dibuja debajo la barra propia
  (`TabBar`, con el botón «+» central), solo cuando la ruta actual (`usePathname()`) es una de las cuatro secciones. Tocar una
  sección usa `router.navigate`, que vuelve a la sección si ya estaba abierta en vez de apilar otra. El «+» abre `/transactions/new`
  y solo aparece si hay moneda principal. No se mueve ningún archivo ni cambia ninguna ruta.
- **Por qué no `Tabs`** (lo que decía la primera versión de este plan): dentro de un navegador de pestañas los formularios ocultos
  quedan montados al salir de ellos, así que «Registrar movimiento» reabriría con el monto y la categoría de la vez anterior (cambia
  el comportamiento, FR-020), y habría que reescribir los guardias de sesión y `guards.test.tsx`. Con la pila nada de eso cambia.
- **Comportamiento de «atrás»**: desde una sección, «atrás» vuelve a la anterior de las abiertas (Inicio → Movimientos → Cuentas y de
  vuelta); dos «atrás» desde Inicio siguen saliendo de la app.
- **Alternativas**: `Tabs` de expo-router (arriba); reorganizar en `(tabs)` con una pila por sección (mueve ~15 archivos y rompe
  pruebas); botón ancho en Inicio (hay que volver a Inicio para anotar un gasto).
- **El nombre accesible «Registrar movimiento»** pasa de Inicio al «+»; así no hay dos controles con el mismo nombre en una pantalla
  (el detalle de una cuenta, que no tiene barra, lo conserva). Las dos pruebas de `us2-onboarding.test.tsx` (líneas 347 y 357) se
  ajustan a propósito: la regla de moneda principal pasa a comprobarse sobre el «+» en `us4-tabbar.test.tsx`.

### D5b. Zonas seguras y tamaños de pantalla: `react-native-safe-area-context`

- **Hecho**: ya está en `package.json` pero hoy ninguna pantalla la usa. expo-router ya envuelve la app en su `SafeAreaProvider`.
- **Decisión**: `Screen`, `ScreenBackground`, `TabBar` y el aviso «Deshacer» leen `useSafeAreaInsets()` y suman el margen superior
  (muesca, barra de estado) e inferior (barra de gestos o de botones). Los formularios con teclado mantienen su botón
  «Guardar» fijo sobre el teclado, sin que lo tape la barra inferior.
- **Se comprueba** en el emulador con un perfil de pantalla pequeña y otro grande, y con navegación por gestos y por tres botones
  (`adb shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.gestural` y `…threebutton`).

### D6. Pantalla de arranque y fondo del ícono

- `expo-splash-screen` admite una variante `dark`: crema `#F6F3EA` en claro y `#14180F` en oscuro con el ícono de Saveria, para
  que no destelle en blanco ni en azul. El fondo del ícono adaptable (`#E6F4FE`) pasa a crema. Aplica al compilar de nuevo.

### D7. Forma de hoja, sombras y lámina (optimización)

- **Forma de hoja**: tarjeta de balance y botón «+» son vistas normales con radios distintos por esquina (34/12 y 20/8); no hace
  falta imagen. Solo las nervaduras decorativas y la forma de fondo usan `react-native-svg`, estáticas y sin animación.
- **Dos sombras por pantalla** (balance y «+») en vez de una por tarjeta: cada sombra cuesta al desplazar.
- **Lámina única** de cuentas y movimientos con filas simples y una línea, no una tarjeta por fila: la lista de 5000 movimientos
  dibuja menos piezas. Cuentas en una fila horizontal que se desliza, así con 3 o 20 cuentas la pantalla mide lo mismo.
- **Sin nada más**: no hay degradados, desenfoques ni motores de animación o de dibujo aparte; Expo los ofrece pero agregan peso.
  El historial sigue con `SectionList` (ya cumple lo medido en la 002) y se vuelve a medir.
- **Íconos importados uno por uno** y tamaño del paquete medido antes y después.

### D8. Cómo se prueba el contraste y que no haya colores sueltos

- `theme-contrast.test.ts` calcula la razón de contraste con la fórmula de WCAG sobre `palettes.ts` (incluidos `hero` y los
  tonos de categoría) y falla si algún par baja de 4,5 (3 en bordes e íconos). No necesita ninguna librería.
- `theme-tokens.test.ts` recorre `src/` y falla si encuentra `#rrggbb`, `rgb(` o `rgba(` fuera de `theme/palettes.ts`.
- `category-icons.test.ts` falla si alguna categoría no tiene ícono o tono.

### D9. Verificar los dos modos en el emulador

`adb shell cmd uimode night yes` y `night no` cambian el modo del emulador sin tocar la app, y permiten probar el cambio con la
app abierta y con un formulario a medias (US7, escenario 3). `adb shell settings put system font_scale 1.5` prueba el 150 % de
letra (SC-005).

### D10. Lugar para los módulos futuros (mapa de la app)

- **Decisión**: el lugar de cada módulo de la visión (registro por IA, confirmación, resumen, recurrentes, deudas, metas,
  asistente, presupuestos, notas de voz, plan) queda fijado en `docs/mapa-de-la-app.md`. Esta feature solo deja la
  estructura: barra armada desde una lista, Inicio por bloques en orden fijo, encabezado propio en Registrar, Movimientos y
  Cuentas como pantallas contenedoras y Ajustes por grupos.
- **Razón**: la visión pone la entrada conversacional como forma principal de registro; si la navegación se diseña solo para
  lo que existe hoy, habría que rehacerla al llegar la IA. Dejar la estructura cuesta poco y no agrega nada visible.
- **Lo único que cambiará de lugar**: Ajustes pasa de la barra a un engranaje en Inicio cuando entre la pestaña Saveria
  (feature 004). Hoy se queda en la barra para que esta quede completa y pareja.
- **Alternativas**: diseñar solo para hoy (rehacer después); mostrar desde ya secciones «próximamente» (contradice FR-019 y
  confunde).

## Fuera de esta feature (queda anotado)

- Interruptor propio claro/oscuro y modo oscuro «forzado» desde Ajustes.
- Gráficos, resumen del mes, «gasto del mes», metas, mapa, foto de perfil, tarjetas (FR-019).
- Animaciones elaboradas e ilustraciones nuevas (solo la forma de fondo, la hoja y los íconos).
