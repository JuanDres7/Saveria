# Contrato de interfaz: Rediseño visual de la app

**Fecha**: 2026-11-09 (revisado con «La hoja de Saveria») | **Plan**: [plan.md](plan.md)

Esta feature no cambia el API: `specs/002-accounts-transactions/contracts/openapi.yaml` (v0.2.0) sigue vigente tal cual. El contrato
que importa aquí es el de la interfaz: qué ofrece el tema y qué deben cumplir las piezas compartidas. Las pruebas lo hacen cumplir.

## 1. Tema (`apps/mobile/src/theme`)

```ts
useTheme(): { scheme: 'light' | 'dark'; colors: ThemeColors; radius; space; type; fonts; shadow }
useStyles<T>(factory: (theme) => T): T   // estilos memorizados por modo
```

Reglas:
- `scheme` sale de `useColorScheme()`; si el sistema no informa modo, es `light`.
- `ThemeColors` tiene exactamente los mismos nombres en las dos paletas (el tipo lo obliga: una paleta no compila si le falta un token).
- Ningún archivo fuera de `theme/palettes.ts` contiene `#rrggbb`, `rgb(` ni `rgba(` (FR-007, SC-007).
- `negative` se usa solo para saldos negativos y errores; el monto de un gasto usa `text` con signo «−» y el de un ingreso `positive` con «+» (FR-008).
- `fonts.display` (letra de identidad) se usa solo en títulos y cifras grandes; todo lo demás, la letra del sistema (FR-004).
- Cambiar de modo vuelve a dibujar sin desmontar la navegación y sin perder el estado de los formularios (FR-030).

## 2. Piezas compartidas (`apps/mobile/src/ui`)

| Pieza | Propiedades | Obligaciones |
|---|---|---|
| `Icon` | `icon` (componente de lucide), `size?`, `color?` (token del tema), `label?` | Oculto para lectores de pantalla salvo que sea el único contenido de un control; color por defecto `text`. |
| `CategoryIcon` | `slug`, `size?` | Círculo con el tono de la categoría (`sage`, arena, niebla, arcilla o neutro) y su ícono en la tinta del tono. |
| `Leaf` | `variant` (`balance` o `fab`), `children` | Vista con la forma de hoja (esquinas 34/12 o 20/8, opuestas); la variante `balance` dibuja las nervaduras con `react-native-svg` detrás del contenido, fuera del orden de foco. |
| `Card` | `children`, `tone?` (`surface` o `soft`) | Radio `card`, plana (sin sombra); no es tocable por sí sola. |
| `ScreenBackground` | `children` | Fondo `background` y una forma orgánica `sage` en la esquina superior, detrás del contenido y fuera del orden de foco; el contenido queda dentro de la zona segura. |
| `BackButton` | `onPress?` | Círculo `surfaceSoft` con `ChevronLeft`, `accessibilityLabel="Volver"`, ≥ 48 dp; por defecto `router.back()`. Va en el encabezado de formularios y detalles. |
| `TabBar` | rutas de las cuatro secciones | Ver abajo. |

### Barra inferior (`TabBar`)

- Cinco lugares: Inicio, Movimientos, **«+»**, Cuentas, Ajustes. Los cuatro destinos son pestañas con ícono y nombre, la actual con fondo `sage` y texto en negrita, objetivo ≥ 48 dp y estado seleccionado para lectores de pantalla.
- El «+» es un botón (`accessibilityRole="button"`, `accessibilityLabel="Registrar movimiento"`, ≥ 48 dp) con la variante `fab` de `Leaf` y la única sombra de la barra. Abre `/transactions/new`. **Solo se dibuja si el usuario tiene moneda principal** (la regla de las features 001 y 002); si no, el lugar queda vacío para que la barra no se descuadre.
- Suma el margen inferior del sistema (`useSafeAreaInsets()`) a su alto. El «+» sobresale de la barra: nada lo tapa ni se solapa con él.
- Solo se pinta cuando la ruta actual es una de las cuatro secciones. En formularios, detalles, auth, onboarding y `verify-email-gate` no aparece, ni el «+» tampoco.
- El aviso «Deshacer» se coloca por encima de la barra y del «+» (altura de la barra + parte que sobresale + margen del sistema), nunca debajo ni encima del «+».

## 2b. Zonas seguras

- Toda pantalla respeta los márgenes del sistema (muesca, barra de estado, barra de gestos o de botones) con
  `useSafeAreaInsets()` de `react-native-safe-area-context`.
- `ScreenBackground` pinta la forma hasta el borde, pero el contenido queda dentro de la zona segura.
- Ningún botón principal ni campo queda bajo la barra de gestos, ni con el teclado abierto.

## 3. Accesibilidad que no cambia

- Los nombres accesibles (`accessibilityLabel`, `accessibilityRole`) y los `testID` que ya usan las pruebas de la 001 y la 002 se conservan, con **dos excepciones intencionales** (FR-020): (1) el botón «Registrar movimiento» pasa de Inicio al «+» de la barra, con el mismo nombre y la misma regla de moneda principal; (2) «Cuentas de dinero», «Configuración» y «Cerrar sesión» salen de Inicio (a la barra y a Ajustes).
- Un mismo nombre accesible no se repite en una pantalla: «Registrar movimiento» vive solo en el «+» (y en el detalle de una cuenta, donde no hay barra).
- Todo control tiene objetivo táctil ≥ 48 dp (FR-024).
- El texto escala con el tamaño de letra del sistema sin cortarse (FR-025); la tarjeta de balance reduce la cifra antes de truncarla.
- `RadioOption` marca la opción elegida con un ícono de verificación además del borde y el fondo (FR-026); un campo con error muestra un ícono de alerta junto al texto.
- Gastos e ingresos siempre llevan signo («−», «+») además de color (FR-008, FR-026); los estados (error, aviso, seleccionado) llevan ícono o texto además de color.

## 4. Barra inferior: qué rutas pertenecen a qué sección

| Sección | Ruta | Se alcanzan desde ella |
|---|---|---|
| Inicio | `/home` | Transferir (`/transfer`); el «+» abre `/transactions/new` |
| Movimientos | `/transactions` | Detalle y edición (`/transactions/[id]`); el «+» |
| Cuentas | `/accounts` | Nueva (`/accounts/new`), detalle (`/accounts/[id]`), archivadas, ajustar saldo; el «+» |
| Ajustes | `/settings` | Cambiar contraseña, borrar cuenta, cerrar sesión; el «+» |
| Detalle de cuenta | `/accounts/[id]` | «Registrar movimiento» y «Transferir desde esta cuenta» (sin barra) |

La barra se muestra solo en las cuatro rutas de la columna «Ruta» (salvo detalle). `verify-email-gate`, auth y onboarding nunca la muestran.

## 4b. Estructura para lo que viene (FR-032)

- `TabBar` se arma desde la lista `TAB_ITEMS`; agregar, quitar o cambiar una sección no toca el componente. Cada elemento
  admite un punto de aviso, hoy sin usar.
- Inicio dibuja una lista ordenada de bloques; el orden completo, con los bloques futuros, está en
  `docs/mapa-de-la-app.md`.
- `RegisterHeader` es el lugar del futuro selector «Contar | A mano». Hoy solo muestra volver y título.
- Movimientos y Cuentas son pantallas contenedoras cuya lista es una parte propia.
- Ninguna de estas piezas muestra hoy contenido de funciones que no existen.

## 5. Mensajes cuando no hay datos (FR-013)

| Pantalla | Mensaje |
|---|---|
| Inicio sin movimientos (con moneda principal) | «Aún no tienes movimientos. Toca el botón + para registrar el primero.» |
| Historial | «Todavía no hay movimientos.» (texto actual) y debajo «Cuando registres uno, aparecerá aquí.» |
| Cuentas archivadas | «No tienes cuentas archivadas.» |
| Inicio sin moneda principal | sin invitación a registrar (no se puede aún) |
