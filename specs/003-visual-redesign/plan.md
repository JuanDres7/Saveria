# Implementation Plan: Rediseño visual de la app

**Branch**: `feat/003-visual-redesign` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-visual-redesign/spec.md`

## Summary

Dar a Saveria una identidad visual propia (verdes oliva sobre crema, tarjetas muy redondeadas, íconos de línea
fina, barra inferior de cuatro secciones) en **modo claro y modo oscuro**, aplicada a las 23 pantallas que ya
existen, sin cambiar su comportamiento. El enfoque técnico:

1. **Enmienda de la constitución** (v1.2.0) que permite librerías de interfaz. Es el primer paso y se aprueba
   aparte.
2. **Tema con dos paletas** (claro y oscuro) que sigue el modo del teléfono. Los colores dejan de ser
   constantes importadas y pasan a salir de un hook, `useTheme()`.
3. **Dos librerías nuevas**: `lucide-react-native` (íconos de línea) y `react-native-svg` (que las dibuja y
   pinta las formas de fondo). Todo lo demás ya viene con Expo.
4. **Componentes base compartidos** (`Card`, `Icon`, `ScreenBackground`, barra inferior) y restyle de los que ya
   existen, pantalla por pantalla, con una revisión visual en emulador en los dos modos por cada historia.

La paleta, los contrastes y las maquetas de Inicio y Movimientos en ambos modos están en
https://claude.ai/artifact/1P4JwJozqdxgfadBRe5vCT para que las apruebes antes de escribir código.

## Technical Context

**Language/Version**: TypeScript 6 sobre Expo SDK 58, React Native 0.88, React 19.3 (sin cambios).

**Primary Dependencies**: las de la 002, más `lucide-react-native` (íconos) y `react-native-svg` 15.16.0 (la
versión que fija Expo 58). Ninguna otra. `react-native-safe-area-context` (~5.10.1) ya está instalada y no se
agrega: se empieza a usar para las zonas seguras. Ver [research.md](research.md).

**Storage**: N/A. No cambia el modelo de datos ni la base local. El modo claro u oscuro no se guarda: lo da el
teléfono.

**Testing**: `jest-expo` + `@testing-library/react-native` para componentes y pantallas (en los dos modos);
pruebas de contraste calculadas sobre las paletas; prueba de «cero colores sueltos»; recorrido manual en
emulador (adb) en modo claro y oscuro. Las pruebas de la 001 y la 002 (api, shared, mobile) siguen verdes.

**Target Platform**: Android, teléfono, vertical (igual que hoy).

**Project Type**: app móvil con API (solo cambia `apps/mobile`).

**Performance Goals**: no empeorar lo medido en la 002: registrar un gasto ≤ 1,5 s (SC-001) y lista de 5000
movimientos sin trabarse (SC-004: ≤ 8 ms / 11 ms por cuadro). Cambio de modo sin parpadeo ni pérdida de estado.

**Constraints**: sin conexión igual que hoy; nada queda tapado por la muesca, la barra de estado ni la barra de
gestos, en cualquier tamaño de pantalla; objetivos táctiles ≥ 48 dp; texto escalable; contraste ≥ 4,5:1
(3:1 en bordes e íconos); registrar sigue en máx. 3 toques más el monto; sin funciones nuevas (FR-019).

**Scale/Scope**: 23 pantallas, 11 archivos que hoy importan el tema, 15 hojas de estilo, 26 categorías (+
transferencia y ajuste) con ícono, 2 paletas.

## Constitution Check

*GATE: debe pasar antes de la Fase 0 y se revisa de nuevo tras el diseño.*

| Principio / regla | Estado | Nota |
|---|---|---|
| I. Dos puertas, un solo caso de uso | Pasa | No se toca la lógica de movimientos. |
| II. La IA propone, el usuario decide | Pasa | Sin cambios de comportamiento. |
| III. Offline primero | Pasa | Íconos y formas van dentro de la app; no se descarga nada (por eso tampoco fuentes). |
| IV. Precisión monetaria | Pasa | Solo cambia cómo se ven los montos, no cómo se calculan ni formatean. |
| V. Categorización | Pasa | Las 26 categorías conservan su `slug`; el ícono se asocia por `slug`. |
| VI. Privacidad | Pasa | No hay datos ni servicios nuevos; los registros siguen sin montos. |
| VII. Clean Architecture y contratos | Pasa | Solo capa de presentación; `openapi.yaml` no cambia. |
| VIII. Pruebas guiadas por la especificación | Pasa | Pruebas primero, en los dos modos (ver matriz). |
| Stack: «Prohibido sin enmienda: agregar servicios o herramientas fuera de esta lista» | **Requiere enmienda** | `lucide-react-native` y `react-native-svg` no están en la lista. Se resuelve con la v1.2.0 (abajo). |

### Enmienda propuesta (v1.2.0, cambio MINOR)

En la sección «Stack y restricciones técnicas», la línea «Prohibido sin enmienda» pasa a decir:

> **Prohibido sin enmienda**: agregar servicios o herramientas de backend, datos, IA o infraestructura fuera de
> esta lista (por ejemplo Firebase, Supabase, MongoDB, una base vectorial aparte, otro proveedor de correo).
> **Librerías de interfaz de la app** (íconos, dibujo vectorial, componentes visuales) se pueden agregar sin
> enmienda si cumplen las cuatro condiciones: (1) están mantenidas y son compatibles con la versión de Expo del
> proyecto; (2) no hacen llamadas de red ni envían datos; (3) funcionan sin conexión; (4) el plan de la
> funcionalidad que las usa las justifica en *Complexity Tracking*.

Así no hace falta una enmienda nueva por cada librería de interfaz, pero cada una sigue justificada. Se aplica
con `/speckit-constitution` y se commitea aparte, antes de las tareas.

**Re-evaluación tras el diseño (Fase 1)**: pasa. Con la enmienda v1.2.0, las dos librerías cumplen las cuatro
condiciones (ver Complexity Tracking). No se agrega nada más.

## Project Structure

### Documentation (this feature)

```text
specs/003-visual-redesign/
├── plan.md              # Este archivo
├── research.md          # Decisiones: herramientas, paleta, modo oscuro, barra, riesgos
├── data-model.md        # Tema: tokens de las dos paletas + mapa de íconos por categoría
├── contracts/
│   └── ui-contract.md   # Contrato de la interfaz: tokens, hook del tema y componentes compartidos
├── quickstart.md        # Cómo comprobarlo en el emulador, en claro y en oscuro
└── tasks.md             # Lo genera /speckit-tasks
```

### Source Code (repository root)

```text
apps/mobile/
├── app.json                              # splash y fondo del ícono con variante oscura
├── package.json                          # + lucide-react-native, react-native-svg
├── src/
│   ├── theme/                            # reemplaza theme.ts (los imports '../theme' siguen valiendo)
│   │   ├── palettes.ts                   # paleta clara, paleta oscura y el tipo ThemeColors
│   │   ├── tokens.ts                     # radios, espacios, escala de texto, sombras
│   │   └── index.ts                      # useTheme(), useStyles()
│   ├── ui/                               # piezas compartidas nuevas
│   │   ├── Icon.tsx                      # envoltorio de lucide con color del tema y tamaño fijo
│   │   ├── CategoryIcon.tsx              # círculo con el ícono de la categoría
│   │   ├── Card.tsx                      # tarjeta redondeada con sombra leve
│   │   ├── ScreenBackground.tsx          # crema/oscuro + formas orgánicas (svg), respeta la zona segura
│   │   └── TabBar.tsx                    # barra inferior de 4 secciones (suma el margen inferior del sistema)
│   ├── features/
│   │   ├── auth/components.tsx           # Screen, Field, PrimaryButton, Banner... restyle
│   │   ├── transactions/                 # Chip, RecentList, TransactionForm, TransferFormView, UndoSnackbar
│   │   └── accounts/                     # AccountList, AccountFields
│   └── app/
│       ├── (app)/_layout.tsx             # Stack → Tabs con barra propia (rutas intactas)
│       └── (auth), (onboarding), (app)   # pantallas restyle, sin cambiar su lógica
└── tests/
    ├── theme-contrast.test.ts            # contraste de las dos paletas (cálculo WCAG)
    ├── theme-tokens.test.ts              # cero colores sueltos en src/
    ├── category-icons.test.ts            # las 26 categorías + transferencia + ajuste tienen ícono
    └── us*-visual.test.tsx               # pantallas en modo claro y oscuro
```

**Structure Decision**: solo se toca `apps/mobile`. `packages/shared` y `apps/api` no cambian. `theme.ts` se
convierte en la carpeta `theme/` para que la ruta de importación actual (`../theme`) siga funcionando y los 11
archivos que la usan solo cambien de «constante» a «hook».

## Orden de ejecución

0. **Enmienda v1.2.0** (commit aparte, con tu aprobación).
1. **Fundaciones**: instalar las dos librerías con `expo install`; `theme/` con las dos paletas; `useTheme()`;
   pruebas de contraste y de colores sueltos; `Icon`, `CategoryIcon`, `ScreenBackground`, `Card`; pantalla de
   arranque en claro y oscuro.
2. **Componentes base restyle** (Screen, Field, PrimaryButton, Chip, Banner, TextButton, RadioOption).
3. **P1**: Inicio (US1), Registrar y editar (US2), Entrar y onboarding (US3).
4. **P2**: barra inferior (US4), historial y cuentas (US5), modo claro/oscuro verificado de punta a punta (US7).
5. **P3**: configuración y avisos (US6).
6. **Cierre**: recorrido completo del quickstart en emulador, en los dos modos; actualizar README y memoria.

El modo oscuro se construye desde el paso 1 (las paletas y el hook ya lo traen), no al final. Cada historia se
revisa en emulador en los dos modos antes de pasar a la siguiente, y tú apruebas cada grupo de pantallas
comparándolo con la imagen de referencia (SC-008).

## Matriz escenario → prueba

| Historia | Escenarios | Pruebas |
|---|---|---|
| US1 Inicio | 1.1–1.6 | `us1-home-visual.test.tsx` (tarjeta de balance con total o cuenta por defecto, cuentas debajo, lista, estado vacío amable, botón principal) + recorrido en emulador |
| US2 Registrar | 2.1–2.5 | `us2-record-visual.test.tsx` (3 toques + monto sigue valiendo, categorías con ícono, foco, teclado) |
| US3 Entrar | 3.1–3.4 | `us3-auth-visual.test.tsx` (acceso y los 5 pasos conservan campos, errores y nombres accesibles) |
| US4 Barra | 4.1–4.6 | `us4-tabbar.test.tsx` (4 secciones, sección actual marcada, oculta sin sesión u onboarding, registrar y transferir desde Inicio y cuenta) |
| US5 Historial y cuentas | 5.1–5.5 | `us5-lists-visual.test.tsx` (chips de filtro, días, montos con signo y color, cuenta archivada) |
| US6 Ajustes y avisos | 6.1–6.4 | `us6-settings-visual.test.tsx` (avisos Deshacer, correo sin verificar y error de guardado legibles) |
| US7 Claro y oscuro | 7.1–7.5 | `theme-contrast.test.ts`, `theme-tokens.test.ts` y cada prueba visual corrida con `useColorScheme` simulado en `light` y `dark`; cambio de modo con formulario a medias en emulador |
| FR-007 / SC-007 | colores en un solo lugar | `theme-tokens.test.ts` (ningún `#hex` ni `rgb(` fuera de `theme/palettes.ts`) |
| FR-023–026 | accesibilidad | contraste calculado + nombres accesibles que ya usan las pruebas de la 001 y la 002, que no deben romperse |

Las pruebas de la 001 y la 002 son la red de seguridad: si una pantalla restyleada rompe un nombre accesible o
un flujo, falla alguna de las que ya existen.

## Riesgos y cómo se comprueban

| Riesgo | Cómo se controla |
|---|---|
| Convertir la barra inferior en `Tabs` de expo-router puede mostrar la barra en pantallas de formulario o romper `guards.test.tsx` | Rutas y archivos intactos; barra propia que solo se pinta en las 4 secciones; se prueba en emulador y con `guards.test.tsx`. |
| Importar íconos de `lucide-react-native` puede agrandar el paquete | Importar solo los íconos usados (~40) y medir el tamaño del paquete antes y después; si crece más de lo razonable, importar por archivo. |
| Cambiar el estilo de 15 hojas puede mover botones y romper el flujo de 3 toques | Se conservan los nombres accesibles y los `testID`; el recorrido de 3 toques sigue en las pruebas de la 002. |
| Contenido tapado por la muesca, la barra de estado o la barra de gestos (o por la barra inferior propia) en pantallas de otro tamaño | `react-native-safe-area-context` (ya instalada): `Screen` y `ScreenBackground` aplican los márgenes del sistema arriba y abajo; `TabBar` y el aviso «Deshacer» suman el margen inferior; se prueba en el emulador con pantalla pequeña, grande y con navegación por gestos y por botones. |
| Destello blanco al abrir en oscuro | `userInterfaceStyle: "automatic"` ya está; se agrega variante oscura de la pantalla de arranque y del fondo del ícono, y se revisa en emulador. |

## Complexity Tracking

> Las únicas adiciones fuera de lo que ya trae Expo; se justifican según la enmienda v1.2.0.

| Adición | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| `lucide-react-native` | 26 categorías + transferencia, ajuste y 4 pestañas necesitan íconos de línea fina coherentes (FR-009, FR-015). | `@expo/vector-icons` ya viene con Expo, pero sus familias son de trazo grueso o mezclan estilos y no cubren bien las 26 categorías; dibujar 30 íconos a mano en SVG es trabajo y deuda propios. |
| `react-native-svg` | Es lo que dibuja los íconos de lucide y las formas orgánicas de fondo. Expo 58 fija la 15.16.0. | Las formas de fondo con `View` redondeadas no logran el trazo orgánico de la referencia. |
