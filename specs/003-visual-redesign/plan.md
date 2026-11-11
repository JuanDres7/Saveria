# Implementation Plan: Rediseño visual de la app

**Branch**: `feat/003-visual-redesign` | **Date**: 2026-11-09 (revisado con «La hoja de Saveria» y el mapa de la app) | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-visual-redesign/spec.md`

## Summary

Dar a Saveria una identidad visual propia en **modo claro y modo oscuro**, aplicada a las 23 pantallas que ya
existen, sin cambiar su comportamiento. La propuesta aprobada es «La hoja de Saveria»
(https://claude.ai/artifact/HeGUmjPATU7j8e3wmoWTfc): verdes oliva sobre crema, la forma de hoja de la marca en la
tarjeta de balance y en el botón «+», una sola lámina clara para cuentas y movimientos, gastos sin rojo y una letra de
identidad en títulos y cifras grandes. El enfoque técnico:

1. **Constitución v1.2.0** (ya enmendada, commit `07b5d84`): permite librerías de interfaz que cumplan cuatro condiciones.
2. **Tema con dos paletas** que sigue el modo del teléfono; los colores salen de un hook, `useTheme()`.
3. **Herramientas**: `lucide-react-native` (íconos), `react-native-svg` (los dibuja, más la forma de fondo y las
   nervaduras de la hoja) y dos archivos de letra incrustados con `expo-font`, que ya está instalada. Nada más.
4. **Barra inferior de cuatro secciones con botón «+» central**, sobre `Tabs` de expo-router y sin mover rutas.
5. **Estructura lista para lo que viene** según [docs/mapa-de-la-app.md](../../docs/mapa-de-la-app.md): barra armada
   como lista, Inicio por bloques, Registrar con lugar para las dos puertas, Movimientos y Cuentas como contenedores.
   No se construye ninguna función futura.
6. **Liviano a propósito**: dos sombras por pantalla, filas simples, sin degradados, desenfoques ni motores de
   animación.

## Technical Context

**Language/Version**: TypeScript 6 sobre Expo SDK 58, React Native 0.88, React 19.3 (sin cambios).

**Primary Dependencies**: las de la 002, más `lucide-react-native` y `react-native-svg` 15.16.0 (la que fija Expo 58).
`expo-font` (~58.0.9) y `react-native-safe-area-context` (~5.10.1) ya están instaladas y se empiezan a usar. Los dos
archivos de la letra Bricolage Grotesque (SemiBold y Bold, licencia OFL) se copian a `apps/mobile/assets/fonts/`; no
queda ninguna dependencia nueva por ellos. Ver [research.md](research.md).

**Storage**: N/A. No cambia el modelo de datos ni la base local. El modo claro u oscuro no se guarda: lo da el teléfono.

**Testing**: `jest-expo` + `@testing-library/react-native` para componentes y pantallas (en los dos modos); pruebas de
contraste calculadas sobre las paletas; prueba de «cero colores sueltos»; recorrido manual en emulador (adb) en modo
claro y oscuro. Las pruebas de la 001 y la 002 (api, shared, mobile) siguen verdes, con tres ajustes intencionales
(ver «Pruebas existentes que cambian a propósito»).

**Target Platform**: Android, teléfono, vertical (igual que hoy).

**Project Type**: app móvil con API (solo cambia `apps/mobile`).

**Performance Goals**: no empeorar lo medido en la 002 (registrar un gasto en ≤ 1,5 s; lista de 5000 movimientos a
≤ 8 ms / 11 ms por cuadro) y cumplir el SC-004 de esta spec (registrar en máx. 3 toques más el monto y menos de 5 s).
Cambio de modo sin parpadeo ni pérdida de estado. El tamaño del paquete se mide antes y después.

**Constraints**: sin conexión igual que hoy; nada queda tapado por la muesca, la barra de estado ni la barra de
gestos, en cualquier tamaño de pantalla; objetivos táctiles ≥ 48 dp; texto escalable al 150 %; contraste ≥ 4,5:1
(3:1 en bordes e íconos); sin funciones nuevas (FR-019).

**Scale/Scope**: 23 pantallas, 11 archivos que hoy importan el tema, 15 hojas de estilo, 26 categorías (+
transferencia y ajuste) con ícono y tono, 2 paletas, 2 archivos de letra.

## Constitution Check

*GATE: debe pasar antes de la Fase 0 y se revisa de nuevo tras el diseño.*

| Principio / regla | Estado | Nota |
|---|---|---|
| I. Dos puertas, un solo caso de uso | Pasa | No se toca la lógica de movimientos. El mapa reserva el lugar de la puerta de IA en la misma pantalla de Registrar. |
| II. La IA propone, el usuario decide | Pasa | Sin cambios; el mapa reserva el estilo de «dato sugerido» que este principio exige. |
| III. Offline primero | Pasa | Íconos, formas y letra van dentro de la app; no se descarga nada. |
| IV. Precisión monetaria | Pasa | Solo cambia cómo se ven los montos (color y signo), no cómo se calculan ni formatean. |
| V. Categorización | Pasa | Las 26 categorías conservan su `slug`; ícono y tono se asocian por `slug`. |
| VI. Privacidad | Pasa | No hay datos ni servicios nuevos; los registros siguen sin montos. |
| VII. Clean Architecture y contratos | Pasa | Solo capa de presentación; `openapi.yaml` no cambia. |
| VIII. Pruebas guiadas por la especificación | Pasa | Pruebas primero, en los dos modos (ver matriz). |
| Stack: librerías de interfaz (v1.2.0) | Pasa | `lucide-react-native`, `react-native-svg` y la letra incrustada cumplen las cuatro condiciones; la (2) y la (3) se comprueban al instalar (tarea T002) y todas se justifican en *Complexity Tracking*. |

**Re-evaluación tras el diseño (Fase 1)**: pasa. No se agrega nada fuera de lo justificado abajo.

## Project Structure

### Documentation (this feature)

```text
specs/003-visual-redesign/
├── plan.md              # Este archivo
├── research.md          # Decisiones: herramientas, paleta, letra, barra, optimización
├── data-model.md        # Tema: tokens de las dos paletas, medidas, tipografía, íconos y tonos
├── contracts/
│   └── ui-contract.md   # Contrato de la interfaz: tema, piezas compartidas, barra y mensajes vacíos
├── quickstart.md        # Cómo comprobarlo en el emulador, en claro y en oscuro
└── tasks.md             # Lista de tareas
docs/mapa-de-la-app.md   # Dónde vive cada módulo, hoy y después (documento del proyecto)
```

### Source Code (repository root)

```text
apps/mobile/
├── app.json                              # splash claro/oscuro, fondo del ícono, plugin de expo-font con la letra
├── assets/fonts/                         # BricolageGrotesque SemiBold y Bold + OFL.txt
├── package.json                          # + lucide-react-native, react-native-svg
├── src/
│   ├── theme/                            # reemplaza theme.ts (los imports '../theme' siguen valiendo)
│   │   ├── palettes.ts                   # paleta clara, oscura, alias de compatibilidad y el tipo ThemeColors
│   │   ├── tokens.ts                     # radios (incluida la hoja), espacios, tipografía, sombras
│   │   └── index.ts                      # useTheme(), useStyles()
│   ├── ui/                               # piezas compartidas nuevas
│   │   ├── Icon.tsx                      # envoltorio de lucide con color del tema
│   │   ├── category-icons.ts             # slug → ícono y tono
│   │   ├── CategoryIcon.tsx              # círculo con el tono y el ícono de la categoría
│   │   ├── Leaf.tsx                      # forma de hoja (balance y «+»)
│   │   ├── Card.tsx, BackButton.tsx      # tarjeta plana; volver redondo
│   │   ├── ScreenBackground.tsx          # fondo + forma orgánica, respeta la zona segura
│   │   └── TabBar.tsx                    # barra armada desde una lista, con el «+» central
│   ├── features/
│   │   ├── auth/components.tsx           # Screen, Field, PrimaryButton, Banner... restyle
│   │   ├── home/                         # bloques de Inicio en orden fijo (hoy: saludo, aviso, balance, cuentas, movimientos)
│   │   ├── transactions/                 # Chip, RecentList, TransactionForm, TransferFormView, UndoSnackbar, RegisterHeader
│   │   ├── accounts/                     # BalanceCard, AccountTile, AccountList, AccountFields
│   │   └── settings/                     # SettingsGroup
│   └── app/
│       ├── (app)/_layout.tsx             # Stack → Tabs con barra propia (rutas intactas)
│       └── (auth), (onboarding), (app)   # pantallas restyle, sin cambiar su lógica
└── tests/
    ├── theme-contrast.test.ts, theme-tokens.test.ts, theme-hook.test.tsx
    ├── category-icons.test.ts, ui-parts.test.tsx, ui-base-components.test.tsx
    ├── balance-card.test.ts
    └── us1…us7 *-visual.test.tsx, us4-tabbar.test.tsx   # pantallas en modo claro y oscuro
```

**Structure Decision**: solo se toca `apps/mobile` (y `docs/` para el mapa). `packages/shared` y `apps/api` no
cambian. `theme.ts` se convierte en la carpeta `theme/` para que la ruta de importación actual siga funcionando.

## Estructura lista para lo que viene

El mapa ([docs/mapa-de-la-app.md](../../docs/mapa-de-la-app.md)) fija dónde irá cada módulo futuro. Esta feature solo
deja la estructura; ninguna de estas piezas es visible ni agrega funciones (FR-019, FR-032):

| Pieza | Cómo se construye ahora | Qué entrará después sin rediseñar |
|---|---|---|
| Barra | Lista `TAB_ITEMS` (ícono, nombre, ruta, punto de aviso opcional) | Pestaña Saveria (004); «Mi plata» (v2) |
| Inicio | Lista ordenada de bloques (`features/home/`) | Barra para contarle a Saveria, «Por confirmar», «Este mes», «Próximos» |
| Registrar | Encabezado propio (`RegisterHeader`) | Selector «Contar \| A mano» (004) |
| Movimientos | Pantalla contenedora + la lista como parte | Parte «Programados» (v2); marca «por Saveria» (004) |
| Cuentas | Pantalla contenedora + la lista como parte | Partes «Metas» y «Deudas» (v2) |
| Ajustes | Grupos (`SettingsGroup`) | Grupos «Saveria», «Tu plan», «Sincronización» |

## Orden de ejecución

1. **Preparación**: medir el punto de partida, instalar las dos librerías, traer la letra, preparar las pruebas.
2. **Base**: `theme/` con las dos paletas y los tokens; `useTheme()`; pruebas de contraste y de colores sueltos;
   `Icon`, `CategoryIcon`, `Leaf`, `Card`, `BackButton`, `ScreenBackground`; pantalla de arranque; componentes base.
3. **P1**: Inicio (US1), Registrar y editar (US2), Entrar y onboarding (US3).
4. **P2**: barra inferior con el «+» (US4), historial y cuentas (US5), claro y oscuro de punta a punta (US7).
5. **P3**: configuración y avisos (US6).
6. **Cierre**: retirar lo provisional, recorrido completo del quickstart, mediciones, README y memoria.

Mientras no exista la barra (US4), Inicio conserva de forma provisional el botón «Registrar movimiento» y los
enlaces a Cuentas, Configuración y Cerrar sesión. El modo oscuro se construye desde la base, no al final. Cada
historia se revisa en emulador en los dos modos y la aprueba el dueño del proyecto (SC-008).

## Pruebas existentes que cambian a propósito

Solo estas; cualquier otra que falle indica un error del rediseño, no de la prueba. Todas cambian porque cambia lo que
la spec pidió (FR-008, FR-012, FR-014), no por comodidad.

| Prueba | Qué comprueba hoy | Cómo queda | Cuándo |
|---|---|---|---|
| `tests/us2-history.test.tsx:164` | Saldo negativo de una cuenta en `#b91c1c` | Lee el color de `lightColors.negative` | Base (al crear las paletas) |
| `tests/us2-history.test.tsx:76` | El ingreso se ve como `$ 2.000.000` | `+$ 2.000.000`: los ingresos llevan signo «+» (FR-008) | US1 |
| `tests/us2-history.test.tsx:121 y 142` | El total es un texto `Total: $ 80.000 COP` | Es el nombre accesible de la tarjeta de balance (`getByLabelText`); la cifra y la moneda van en textos separados (FR-012) | US1 |
| `tests/us1-record.test.tsx:155` | `-$ 18.000` es único en Inicio | Se busca dentro de la fila del movimiento: el balance también muestra esa cifra | US1 |
| `tests/us2-onboarding.test.tsx:347` | Sin moneda principal, Inicio no tiene «Registrar movimiento» | La regla se comprueba sobre el «+» en `us4-tabbar.test.tsx` | US4 |
| `tests/us2-onboarding.test.tsx:357` | Con moneda principal, Inicio tiene «Registrar movimiento» | Igual: pasa al «+»; en Inicio se conserva la comprobación de «Efectivo» y su saldo | US4 |

## Matriz escenario → prueba

| Historia | Escenarios | Pruebas |
|---|---|---|
| US1 Inicio | 1.1–1.6 | `balance-card.test.ts` (total o cuenta por defecto) · `us1-home-visual.test.tsx` (saludo, tarjeta de balance, cuentas en fila, filas con ícono, cuenta y monto con signo, saldo negativo en rojo, estado vacío, sin conexión, nombre de 40 caracteres, monto de 12 dígitos, 20 cuentas) + emulador |
| US2 Registrar | 2.1–2.5 | `us2-record-visual.test.tsx` (categorías con ícono, 3 toques + monto, «Guardar» visible, errores junto al campo, editar y transferir) |
| US3 Entrar | 3.1–3.4 | `us3-auth-visual.test.tsx` (bienvenida, acceso, 5 pasos con avance, casilla de la política) |
| US4 Barra | 4.1–4.7 | `us4-tabbar.test.tsx` (4 secciones, actual marcada, «+» abre Registrar, «+» ausente sin moneda principal, barra oculta en formularios, auth, onboarding y bloqueo, «Cerrar sesión» en Ajustes) · `guards.test.tsx` |
| US5 Historial y cuentas | 5.1–5.5 | `us5-lists-visual.test.tsx` (chips de filtro, días, montos, cuenta por defecto, rechazos del servidor, paginación, estados vacíos) |
| US6 Ajustes y avisos | 6.1–6.4 | `us6-settings-visual.test.tsx` (grupos, textos inequívocos de borrar cuenta, borrar movimiento y cerrar sesión con cambios pendientes, avisos) |
| US7 Claro y oscuro | 7.1–7.5 | `theme-contrast.test.ts`, `theme-hook.test.tsx`, `us7-modes.test.tsx` y cada prueba visual corrida en `light` y `dark`; cambio de modo con formulario a medias en emulador |
| FR-004 | letra de identidad solo en títulos y cifras grandes | `ui-base-components.test.tsx` y `us1-home-visual.test.tsx` |
| FR-007 / SC-007 | colores en un solo lugar | `theme-tokens.test.ts` |
| FR-008 | gastos con «−» en color de texto, ingresos en verde con «+», rojo solo en negativos y errores | `us1-home-visual.test.tsx`, `us5-lists-visual.test.tsx` |
| FR-009 | ícono y tono por categoría | `category-icons.test.ts` |
| FR-013 | mensajes cuando no hay datos | `us1-home-visual.test.tsx`, `us5-lists-visual.test.tsx` |
| FR-016 | volver atrás en detalle y formularios | `ui-parts.test.tsx` (`BackButton`) y las pruebas visuales de US2, US5 y US6 |
| FR-023–026, SC-005 | accesibilidad y letra al 150 % | contraste calculado, `ui-base-components.test.tsx` con `fontScale: 1.5`, emulador con `font_scale 1.5` |
| FR-031 | forma de hoja | `ui-parts.test.tsx` (`Leaf`) |
| FR-032 | estructura lista para el mapa | `us4-tabbar.test.tsx` (la barra se arma desde la lista) y `us1-home-visual.test.tsx` (orden de los bloques) |

## Riesgos y cómo se comprueban

| Riesgo | Cómo se controla |
|---|---|
| Pasar a `Tabs` de expo-router puede mostrar la barra en formularios, alterar el botón «atrás» o romper `guards.test.tsx` | Rutas y archivos intactos; barra propia que solo se pinta en las 4 secciones; se confirma si `Tabs.Protected` existe en expo-router ~58; emulador y `guards.test.tsx`. |
| Importar íconos de `lucide-react-native` puede agrandar el paquete | Importar solo los íconos usados y medir el paquete antes y después; si crece de forma desproporcionada, importar por archivo. |
| La letra incrustada puede no tener cifras tabulares o pesar más de lo esperado | Se comprueba al traer los archivos (T003); si no sirve, la cifra del balance usa la del sistema. |
| El «+» puede solaparse con el nombre de una sección en pantallas angostas o con letra al 150 % | Columna central de ancho fijo; se prueba en pantalla pequeña y con `font_scale 1.5`. |
| Cambiar 15 hojas de estilo puede mover botones y romper el flujo de 3 toques | Se conservan los nombres accesibles y los `testID`; el recorrido de 3 toques sigue en las pruebas. |
| Contenido tapado por la muesca, la barra de estado o la de gestos | `react-native-safe-area-context`: `Screen`, `ScreenBackground`, `TabBar` y «Deshacer» suman los márgenes del sistema; emulador con pantalla pequeña y grande, gestos y tres botones. |
| Destello blanco al abrir en oscuro | Pantalla de arranque con variante oscura y fondo del sistema fijado al del tema; se revisa en emulador. |

## Complexity Tracking

> Las únicas adiciones fuera de lo que ya trae la app; se justifican según la constitución v1.2.0.

| Adición | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| `lucide-react-native` | 26 categorías, transferencia, ajuste, pestañas y controles necesitan íconos de línea fina coherentes (FR-005, FR-009). | `@expo/vector-icons` mezcla estilos o es de trazo grueso; dibujar los íconos a mano es trabajo y deuda propios. |
| `react-native-svg` | Dibuja los íconos de lucide, la forma de fondo y las nervaduras de la hoja. Expo 58 fija la 15.16.0. | Las formas con vistas redondeadas no logran el trazo orgánico de la referencia. |
| Letra Bricolage Grotesque (2 archivos, incrustados con `expo-font`) | Da identidad a títulos y cifras grandes (FR-004) y, por ser angosta, deja caber montos largos en pesos. | Solo la letra del sistema: más liviano, pero la app se ve como cualquier otra; el dueño del proyecto eligió la letra propia. |
