# Modelo del tema: Rediseño visual de la app

**Fecha**: 2026-11-09 | **Plan**: [plan.md](plan.md)

Esta feature no cambia datos ni la base local. El único «modelo» es el de la identidad visual (entidad **Identidad
visual (tema)** de la spec): colores con nombre por su función, en dos variantes, más medidas.

## Colores (`apps/mobile/src/theme/palettes.ts`)

Todos los nombres se mantienen entre los dos modos; solo cambia el valor. Los nombres que ya existen en `theme.ts`
conservan su significado.

| Token | Para qué sirve | Claro | Oscuro |
|---|---|---|---|
| `background` | fondo de pantalla | `#F6F3EA` | `#14180F` |
| `surface` | tarjetas, filas, barra inferior | `#FCFBF7` | `#1D2217` |
| `surfaceSoft` | chips, cuentas, campos, fondos de apoyo | `#ECE9D8` | `#272D1F` |
| `sage` | círculo de categoría, ítem activo de la barra | `#DDE2C8` | `#2F3A24` |
| `shape` | formas orgánicas de fondo (solo decorativo) | `#8F9B6B` | `#8F9B6B` |
| `primary` | botón principal, ítem activo, chip elegido, enlaces | `#3F4A28` | `#B9C78C` |
| `onPrimary` | texto e ícono sobre `primary` | `#FCFBF7` | `#1A2010` |
| `text` | texto principal | `#1F2616` | `#ECEBDD` |
| `textMuted` | texto secundario y ayudas | `#575E45` | `#B1B69F` |
| `border` | borde de campos y controles | `#7D8468` | `#7E8568` |
| `divider` | separadores | `#E3DFCB` | `#2C3322` |
| `disabled` | controles inactivos | `#8A8F78` | `#5A604B` |
| `negative` | gastos y saldos negativos | `#B3261E` | `#F2A39B` |
| `positive` | ingresos | `#2F6B2A` | `#A5D68A` |
| `warningBackground` / `warningText` | avisos | `#F6E7B8` / `#5C4310` | `#3B3217` / `#F3DFA2` |
| `inverse` / `onInverse` | aviso «Deshacer» (snackbar) | `#2B3320` / `#F6F3EA` | `#ECEBDD` / `#14180F` |

Los tokens que hoy existen y desaparecen o se renombran (`primarySoft`, `textStrong`, `inverseAccent`) se reasignan en
la fase de componentes base; ninguno queda sin usar.

### Reglas de contraste (se prueban en `theme-contrast.test.ts`)

| Par | Mínimo | Claro | Oscuro |
|---|---|---|---|
| `text`, `textMuted` sobre `background`, `surface`, `surfaceSoft` | 4,5 | 5,6–15,1 | 6,8–15,0 |
| `onPrimary` sobre `primary` | 4,5 | 9,1 | 9,2 |
| `primary` sobre `background`, `surface`, `sage` | 4,5 | 7,1–9,1 | 6,6–10,0 |
| `negative`, `positive` sobre `background`, `surface` | 4,5 | 5,8–6,3 | 8,1–10,8 |
| `warningText` sobre `warningBackground` | 4,5 | 7,5 | 9,6 |
| `border` sobre `background`, `surface` | 3,0 | 3,5–3,8 | 4,2–4,7 |
| `shape` | solo decorativo | 2,7 (no se usa para texto ni íconos) | 5,5 |

## Medidas (`apps/mobile/src/theme/tokens.ts`)

| Token | Valor |
|---|---|
| `radius.card` | 24 dp (tarjetas grandes, balance) |
| `radius.row` | 22 dp (listas) |
| `radius.control` | 16 dp (campos, avisos) |
| `radius.pill` | 999 (botón principal, chips, pestañas) |
| `space` | 4, 8, 12, 16, 20, 24, 32 |
| `touch` | 48 dp mínimo |
| `icon` | 20 dp en filas, 24 dp en barra, trazo 1,75 |
| Tipografía | fuente del sistema; título 24/700, subtítulo 16/700, texto 15/400, ayuda 13/400, cifra grande 30/700 con cifras tabulares |

Las medidas de tipografía respetan el tamaño de letra del sistema (`allowFontScaling`), y la cifra grande reduce su
tamaño antes de cortarse.

## Íconos por categoría (`apps/mobile/src/ui/CategoryIcon.tsx`)

Se asocia por `slug` (nunca por el nombre visible). Los nombres de ícono son de lucide; se confirman al instalar la
versión y la prueba `category-icons.test.ts` avisa si alguno ya no existe.

| Gasto | Ícono | Ingreso | Ícono |
|---|---|---|---|
| `groceries` | `ShoppingCart` | `salary` | `Banknote` |
| `dining` | `Utensils` | `bonus` | `Award` |
| `transport` | `Bus` | `freelance` | `Laptop` |
| `vehicle` | `Car` | `business` | `Store` |
| `housing` | `House` | `investments` | `TrendingUp` |
| `utilities` | `Zap` | `gifts_received` | `HandHeart` |
| `health` | `HeartPulse` | `refunds` | `Undo2` |
| `personal_care` | `Scissors` | `other_income` | `CirclePlus` |
| `education` | `GraduationCap` | | |
| `subscriptions` | `Repeat` | **Otros tipos** | |
| `entertainment` | `Clapperboard` | transferencia | `ArrowLeftRight` |
| `shopping` | `ShoppingBag` | ajuste de saldo | `Scale` |
| `home_family` | `Users` | | |
| `pets` | `PawPrint` | | |
| `gifts` | `Gift` | | |
| `travel` | `Plane` | | |
| `fees_taxes` | `FileText` | | |
| `other_expense` | `Ellipsis` | | |

Pestañas: Inicio `House`, Movimientos `ReceiptText`, Cuentas `Wallet`, Ajustes `Settings`. Otros: `Plus` (registrar),
`Bell`, `ChevronDown` (filtros), `ChevronRight` (filas), `Mail` (correo sin verificar), `Leaf` (marca).

## Estados

La identidad visual no tiene ciclo de vida. Su único «cambio de estado» es de modo (claro ↔ oscuro) y es inmediato: el
hook `useTheme()` vuelve a dibujar las pantallas abiertas sin reiniciar la navegación ni perder lo escrito.
