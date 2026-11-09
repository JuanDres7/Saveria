# Investigación: Rediseño visual de la app

**Fecha**: 2026-11-09 | **Plan**: [plan.md](plan.md)

No quedaron marcadores `NEEDS CLARIFICATION`. Lo que sigue registra lo que se verificó y las decisiones.

## Hechos verificados en el repositorio

- `node_modules` no trae `@expo/vector-icons`, `react-native-svg` ni `expo-linear-gradient`. `apps/mobile/package.json`
  solo tiene `expo-font`. Hoy la app no dibuja ningún ícono.
- `expo/bundledNativeModules.json` (Expo 58) fija `react-native-svg` en **15.16.0** y `@expo/vector-icons` en `^15.0.2`.
- `lucide-react-native` 1.70.0 declara como peer `react-native-svg` `^12 || ^13 || ^14 || ^15` y `react` hasta la 19, así que
  es compatible con React 19.3 y con la 15.16.0 de Expo.
- `apps/mobile/app.json` ya trae `"userInterfaceStyle": "automatic"`. La pantalla de arranque tiene fondo azul
  `#208AEF` y el ícono adaptable `#E6F4FE`: ambos son colores de la plantilla, no de Saveria.
- Solo 11 archivos importan `theme`, hay 15 `StyleSheet.create` y unos 34 usos de `colors.`; el rediseño es
  abarcable sin tocar la lógica.
- El catálogo tiene 18 categorías de gasto y 8 de ingreso con `slug` estable (`packages/shared/src/catalog/categories.ts`).

## Decisiones

### D1. Íconos: `lucide-react-native` sobre `react-native-svg`

- **Decisión**: usar `lucide-react-native` para todos los íconos y `react-native-svg` para dibujarlos y para las formas de
  fondo.
- **Razón**: la referencia usa íconos de línea fina y lucide es exactamente ese estilo, con trazo ajustable; cubre las 26
  categorías con un solo estilo; se importa ícono por ícono; es compatible con la versión de Expo.
- **Alternativas**: `@expo/vector-icons` (ya viene con Expo): Feather es de línea pero tiene pocos íconos y las otras
  familias mezclan estilos o son rellenas; dibujar los íconos a mano: trabajo y deuda propios sin beneficio.

### D2. Modo claro y oscuro: `useColorScheme` + dos paletas

- **Decisión**: el tema se resuelve con `useColorScheme()` de React Native (ya incluido) y un hook `useTheme()` que devuelve
  la paleta activa. Cambia solo cuando cambia el modo del teléfono; no hay interruptor propio ni se guarda nada.
- **Razón**: `userInterfaceStyle: "automatic"` ya está; sigue lo que el usuario ya eligió en su teléfono y elimina estado
  y pantallas nuevas.
- **Alternativas**: interruptor propio en Ajustes (queda fuera de alcance, FR-028); una librería de temas (innecesaria).

### D3. Paleta

Paleta clara y oscura, con los contrastes calculados con la fórmula de WCAG 2.1. Valores completos en
[data-model.md](data-model.md); maqueta aprobable en https://claude.ai/artifact/1P4JwJozqdxgfadBRe5vCT.

- **Claro**: crema `#F6F3EA` de fondo, tarjetas `#FCFBF7`, verde musgo `#3F4A28` para la acción principal y el ítem activo,
  salvia `#DDE2C8` para círculos de categoría, texto `#1F2616`.
- **Oscuro**: verde casi negro `#14180F` de fondo, tarjetas `#1D2217`, el verde de acción pasa a oliva claro `#B9C78C`
  (con texto oscuro encima, 9,2:1), texto `#ECEBDD`.
- **Regla**: el oliva medio `#8F9B6B` solo va en formas de fondo. Sobre el crema da 2,7:1, no sirve para texto ni íconos.
- Rojo y verde del dinero cambian de tono en cada modo para conservar contraste (claro: `#B3261E` / `#2F6B2A`; oscuro:
  `#F2A39B` / `#A5D68A`), y siempre van con signo (FR-008, FR-026).
- **Resultado**: todos los pares de texto cumplen 4,5:1 y los bordes de campo 3:1 en los dos modos (rango 4,2–15).

### D4. Tipografía, sombras, formas

- **Fuente del sistema** (Roboto en Android), con escala fija de tamaños y pesos. No se descarga ni se incluye ninguna fuente,
  así que `expo-font` no se usa.
- **Sombras**: las nativas de React Native (`elevation` y `shadow*`), suaves en claro; en oscuro se usa una elevación mayor
  más un tono de superficie más claro, porque la sombra casi no se ve.
- **Formas orgánicas**: dos o tres círculos grandes de salvia con opacidad, dibujados con `react-native-svg` en un
  componente `ScreenBackground`. Nunca quedan detrás de texto en tamaños que dificulten leerlo.
- **No se usan degradados** (`expo-linear-gradient`): la referencia se logra con color plano y formas.

### D5. Barra inferior: `Tabs` de expo-router con barra propia

- **Decisión**: `(app)/_layout.tsx` pasa de `Stack` a `Tabs` con cuatro pestañas (Inicio, Movimientos, Cuentas, Ajustes). Las
  demás rutas (registrar, editar, transferir, nueva cuenta, ajustar, cambiar contraseña, etc.) quedan declaradas pero
  ocultas de la barra. La barra se pinta con un componente propio (`TabBar`) y solo se muestra cuando la ruta actual es una de
  las cuatro secciones, para que los formularios tengan todo el alto y el teclado no la empuje.
- **Razón**: no se mueven archivos ni se cambian URLs, así que `guards.test.tsx` y las 15 pantallas conservan su ruta.
- **Alternativas**: reorganizar en `(tabs)` con un `Stack` por sección (más fiel a navegación anidada pero mueve ~15 archivos y
  rompe las pruebas); barra construida a mano fuera del router (pierde el estado de cada pestaña).
- **Riesgo conocido**: el comportamiento del botón «atrás» entre pestañas y pantallas ocultas. Se verifica en emulador (ya se
  sabe que dos «atrás» desde Inicio cierran la app) y queda en la lista de comprobaciones del quickstart.

### D6. Pantalla de arranque y fondo del ícono

- `expo-splash-screen` admite una variante `dark` en la configuración del plugin: se pone crema `#F6F3EA` en claro y
  `#14180F` en oscuro con el ícono de Saveria, para que no destelle en blanco ni en azul (caso límite de la spec).
- El fondo del ícono adaptable (`#E6F4FE`) pasa a crema; el cambio solo aplica al compilar una versión nueva.

### D7. Íconos por categoría

Uno por `slug`, agrupados en dos familias de tono (gasto = salvia, ingreso = verde claro). El mapa completo está en
[data-model.md](data-model.md). Una prueba garantiza que ninguna categoría se quede sin ícono si el catálogo cambia.

### D8. Cómo se prueba el contraste y que no haya colores sueltos

- `theme-contrast.test.ts` calcula la razón de contraste con la fórmula de WCAG sobre `palettes.ts` y falla si algún par baja
  de 4,5 (3 en bordes e íconos). No necesita ninguna librería.
- `theme-tokens.test.ts` recorre `src/` y falla si encuentra `#rrggbb`, `rgb(` o `rgba(` fuera de `theme/palettes.ts`.

### D9. Verificar los dos modos en el emulador

`adb shell cmd uimode night yes` y `night no` cambian el modo del emulador sin tocar nada de la app, y permiten probar el
cambio con la app abierta y con un formulario a medias (US7, escenario 3).

## Fuera de esta feature (queda anotado)

- Interruptor propio claro/oscuro y modo oscuro «forzado» desde Ajustes.
- Gráficos, resumen del mes, metas, mapa, foto de perfil, tarjetas (FR-019).
- Animaciones elaboradas e ilustraciones nuevas (solo formas de fondo e íconos).
