# Contrato de interfaz: Rediseño visual de la app

**Fecha**: 2026-11-09 | **Plan**: [plan.md](plan.md)

Esta feature no cambia el API: `specs/002-accounts-transactions/contracts/openapi.yaml` (v0.2.0) sigue vigente tal cual. El contrato
que importa aquí es el de la interfaz: qué ofrece el tema y qué deben cumplir las piezas compartidas. Las pruebas lo hacen cumplir.

## 1. Tema (`apps/mobile/src/theme`)

```ts
useTheme(): { scheme: 'light' | 'dark'; colors: ThemeColors; radius; space; type; shadow }
useStyles<T>(factory: (theme) => T): T   // estilos memorizados por modo
```

Reglas:
- `scheme` sale de `useColorScheme()`; si el sistema no informa modo, es `light`.
- `ThemeColors` tiene exactamente los mismos nombres en las dos paletas (el tipo lo obliga: una paleta no compila si le falta un token).
- Ningún archivo fuera de `theme/palettes.ts` contiene `#rrggbb`, `rgb(` ni `rgba(` (FR-007, SC-007).
- Cambiar de modo vuelve a dibujar sin desmontar la navegación y sin perder el estado de los formularios (FR-030).

## 2. Piezas compartidas (`apps/mobile/src/ui`)

| Pieza | Propiedades | Obligaciones |
|---|---|---|
| `Icon` | `name`, `size?`, `color?` (token del tema) | Oculto para lectores de pantalla salvo que sea el único contenido de un control; color por defecto `text`. |
| `CategoryIcon` | `slug`, `size?` | Círculo `sage` con el ícono de la categoría; ícono de «otros» si el `slug` no se conoce. |
| `Card` | `children`, `tone?` (`surface` o `soft`) | Radio `card`, sombra leve; no es tocable por sí sola. |
| `ScreenBackground` | `children` | Fondo `background` y formas `shape` con opacidad, detrás del contenido y fuera del orden de foco. |
| `TabBar` | rutas de las cuatro secciones | Cuatro destinos, el actual marcado con `sage` y texto en negrita, objetivo ≥ 48 dp, oculta fuera de las cuatro secciones. |

## 3. Accesibilidad que no cambia

- Los nombres accesibles (`accessibilityLabel`, `accessibilityRole`) y los `testID` que ya usan las pruebas de la 001 y la 002 se conservan.
- Todo control tiene objetivo táctil ≥ 48 dp (FR-023).
- El texto escala con el tamaño de letra del sistema sin cortarse (FR-024); la tarjeta de balance reduce la cifra antes de truncarla.
- Gastos e ingresos siempre llevan signo además de color (FR-008, FR-026); los estados (error, aviso, seleccionado) llevan ícono o texto además de color.

## 4. Barra inferior: qué rutas pertenecen a qué sección

| Sección | Ruta | Se alcanzan desde ella |
|---|---|---|
| Inicio | `/home` | Registrar movimiento (`/transactions/new`) y Transferir (`/transfer`) |
| Movimientos | `/transactions` | Detalle y edición (`/transactions/[id]`) |
| Cuentas | `/accounts` | Nueva (`/accounts/new`), detalle (`/accounts/[id]`), archivadas, ajustar saldo; Registrar y Transferir desde el detalle |
| Ajustes | `/settings` | Cambiar contraseña, borrar cuenta |

La barra se muestra solo en las cuatro rutas de la columna «Ruta». `verify-email-gate`, auth y onboarding nunca la muestran.
