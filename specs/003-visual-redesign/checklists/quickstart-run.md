# Recorrido final del quickstart de la 003

**Fecha**: 2026-11-11 | **Rama**: `feat/003-visual-redesign` | **Emulador**: Android 36, 1080×2400, app de desarrollo reconstruida, API local, cuenta `qs002.final@mail.com`

Los pasos 2 a 7 y 9 se verificaron con capturas al cerrar cada historia (ver `visual-review.md`, aprobadas por el dueño del proyecto). En esta corrida final se repitió lo que depende del conjunto: los íconos con la importación nueva, las pantallas de otro tamaño, el registro sin conexión, las mediciones y los registros.

## Recorrido (T062)

| Paso | Qué se comprobó | Resultado |
|---|---|---|
| 1 Arranque | Pantalla de arranque crema (claro) y verde casi negro (oscuro) | Verificado en T024 (base del tema). El fondo de la raíz y de cada pantalla sale del tema, así que tampoco hay destello al abrir |
| 2 Entrar | Bienvenida, crear cuenta, 5 pasos, iniciar sesión, olvidé mi contraseña | Historia 3, aprobada el 2026-11-10 |
| 3 Inicio | Saludo, tarjeta de balance en hoja, cuentas, últimos movimientos, aviso de correo | Historia 1, aprobada. En esta corrida se vio de nuevo en claro, en oscuro, en pantalla pequeña y en pantalla grande |
| 4 Registrar | «+» → monto → categoría → «Guardar» | 3 toques más el monto; ver medición abajo |
| 5 Barra inferior | Cuatro secciones, «+» central, sin barra en formularios | Historia 4, aprobada. Vista de nuevo en pantalla pequeña con tres botones y en pantalla grande con gestos: la barra queda por encima de los botones del sistema y el «+» no tapa ningún nombre |
| 6 Historial y cuentas | Chips, lista por día, cuentas, ajustar | Historia 5, aprobada |
| 7 Configuración y avisos | Grupos, cambiar contraseña, borrar cuenta (sin confirmar), «Deshacer», correo sin verificar, error de monto | Historia 6, aprobada el 2026-11-11 |
| 8 Cambio de modo con la app abierta | Registrar abierto con datos, `uimode night yes` | Historia 7: cambió sin perder el monto ni la pantalla |
| 9 Letra al 150 % | Inicio, Registrar, Historial, Cuentas | Historia 7: nada se corta; la barra y los saldos achican su letra |
| 10 Rendimiento | 5000 movimientos | Ver mediciones |
| 11 Otros tamaños | 720×1280 (280 dpi) con navegación de tres botones y 1200×2800 (400 dpi) con gestos | Inicio y Registrar se ven completos. En el formulario pequeño con teclado abierto, «Guardar» queda visible sobre el teclado. Nada bajo la barra de estado ni la de navegación |
| 12 Sin conexión | Modo avión y sin túnel a la API; se registró un gasto de 12.000 | Se guardó al instante: el total pasó de $ 80.000 a $ 68.000 y el movimiento aparece en Inicio. Al volver la conexión se envió solo (`PUT /v1/transactions/…` 200 en el registro de la API) |
| 13 Nada de más | Ninguna función del mapa que aún no existe | La barra y las pantallas solo traen lo de la 002; `us4-tabbar.test.tsx` y `us7-modes.test.tsx` recorren las pantallas y los nombres de la barra |

Observación de desarrollo (no es un fallo de la app): al cambiar el tamaño de pantalla o el tipo de navegación del emulador con la app abierta, Android recrea la actividad y el modo de desarrollo muestra un aviso rojo («multiple navigation containers»). Con una apertura limpia de la app no aparece (comprobado dos veces); el aviso no existe en una app de producción.

## Mediciones (T063)

| Medida | Resultado |
|---|---|
| Registrar un gasto | **3 toques** más el monto («+», categoría, «Guardar»). Desde «Guardar» hasta ver el total nuevo en Inicio: **3,3 s** medidos con `adb`, que incluye varias lecturas de pantalla de ~1 s cada una; el guardado en sí es local e inmediato |
| 5000 movimientos | Saldos de 2 cuentas en **4 ms** y primera página (50) en **5 ms** (002: 8 y 11 ms), medido en la historia 5. La importación de íconos no toca esas consultas |
| Tamaño del paquete | Línea base (T001): 4.061.182 bytes. Primera medición con la 003: **6.727.580 bytes (+66 %)**, porque `import { … } from 'lucide-react-native'` arrastra los miles de íconos. Se cambió a importar cada ícono por archivo desde `src/ui/icons.ts`; ahora **4.352.356 bytes (+291.174, +7,2 %)**. `theme-tokens.test.ts` falla si alguien vuelve a importar el índice de lucide |

## Registros (T064)

- **App** (`adb logcat`, etiqueta `ReactNativeJS`, toda la sesión): 0 líneas con montos, correos, contraseñas ni tokens. Solo hay arranques y los avisos de desarrollo de arriba.
- **Metro**: sin montos, correos ni tokens.
- **API** (`api.log` de la sesión): solo método, ruta, estado y duración; 0 coincidencias con montos, correos, contraseñas ni tokens. Las rutas llevan el identificador del movimiento, no su contenido.

## Todas las pruebas (T066), 2026-11-11

| Comprobación | Línea base (T001) | Ahora |
|---|---|---|
| `bun run test` (app, Jest) | 264 pruebas en 20 archivos | **592 pruebas en 35 archivos**, todas en verde (una corrida suelta falló 3 con la máquina cargada y no se repitió: ya se había visto en la línea base) |
| `bun run test:sqlite` | 16 | **16** en verde |
| `bun test` en `packages/shared` | 118 | **118** en verde |
| `bun test` en `apps/api` | no corrió (Docker apagado); 456 al cerrar la 002 | **456** en verde (44 archivos, 60 s): la 003 no tocó la API |
| `bunx biome check .` | 253 archivos | **289 archivos**, sin errores |
| `bunx tsc --noEmit` (app) | sin errores | sin errores |

No hay menos pruebas que en la línea base: las dos comprobaciones de `us1-record` y `us2-history` que cambiaron de forma están anotadas en la tabla de `plan.md`.
