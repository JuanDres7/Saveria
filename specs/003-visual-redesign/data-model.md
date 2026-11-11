# Modelo del tema: Rediseño visual de la app

**Fecha**: 2026-11-09 (revisado con «La hoja de Saveria») | **Plan**: [plan.md](plan.md)

Esta feature no cambia datos ni la base local. El único «modelo» es el de la identidad visual (entidad **Identidad
visual (tema)** de la spec): colores con nombre por su función, en dos variantes, más medidas, tipografía y el
mapa de íconos y tonos por categoría.

## Colores (`apps/mobile/src/theme/palettes.ts`)

Todos los nombres se mantienen entre los dos modos; solo cambia el valor. Es el único archivo del proyecto con colores
(`#hex`). Maqueta aprobada: https://claude.ai/artifact/HeGUmjPATU7j8e3wmoWTfc

| Token | Para qué sirve | Claro | Oscuro |
|---|---|---|---|
| `background` | fondo de pantalla | `#F6F3EA` | `#14180F` |
| `surface` | lámina de contenido, barra inferior, formularios | `#FCFBF7` | `#1D2217` |
| `surfaceSoft` | chips, cuentas, campos, transferencias | `#ECE9D8` | `#272D1F` |
| `sage` | forma de fondo, círculo de categoría base, ítem activo de la barra | `#DDE2C8` | `#2F3A24` |
| `primary` | botón principal, ítem activo, chip elegido, enlaces, botón «+» | `#3F4A28` | `#B9C78C` |
| `onPrimary` | texto e ícono sobre `primary` | `#FCFBF7` | `#1A2010` |
| `hero` | tarjeta de balance (la única pieza de verde oscuro lleno) y parte superior de la bienvenida | `#3F4A28` | `#2C3720` |
| `heroShape` | hoja y nervaduras dentro de `hero` (solo decorativo) | `#4E5B33` | `#394728` |
| `onHero` | texto principal sobre `hero` | `#F6F3EA` | `#ECEBDD` |
| `onHeroMuted` | texto secundario sobre `hero` | `#CDD4B4` | `#B7BEA0` |
| `text` | texto principal y montos de gastos | `#1F2616` | `#ECEBDD` |
| `textMuted` | texto secundario y ayudas | `#575E45` | `#B1B69F` |
| `border` | borde de campos y controles | `#7D8468` | `#7E8568` |
| `divider` | líneas que separan filas | `#E3DFCB` | `#2C3322` |
| `disabled` | controles inactivos | `#8A8F78` | `#5A604B` |
| `negative` | **solo** saldos negativos y errores (rojo ladrillo) | `#A63A24` | `#F0A493` |
| `positive` | ingresos (con signo «+») | `#2F6B2A` | `#A5D68A` |
| `warningBackground` / `warningText` | avisos | `#F6E7B8` / `#5C4310` | `#3B3217` / `#F3DFA2` |
| `inverse` / `onInverse` | aviso «Deshacer» | `#2B3320` / `#F6F3EA` | `#ECEBDD` / `#14180F` |
| `toneSand` / `toneSandInk` | círculo de categoría: comida y compras | `#F1E4C3` / `#6B4E12` | `#3A321C` / `#E6C987` |
| `toneMist` / `toneMistInk` | círculo de categoría: movilidad y viajes | `#D5E4DC` / `#2B5646` | `#223129` / `#A9CDB9` |
| `toneClay` / `toneClayInk` | círculo de categoría: salud y personas | `#F3DACF` / `#8A3A24` | `#402A22` / `#F0B4A2` |

El tono base (casa y obligaciones, e ingresos) usa `sage` con `primary` como tinta; el neutro (otros gastos,
transferencias y ajustes) usa `surfaceSoft` con `textMuted`. Los gastos ya no son rojos: van con signo «−» en `text`.

### Compatibilidad mientras se migran las pantallas

`palettes.ts` define un bloque `legacyColors` sin colores nuevos, solo alias de los de arriba, para que lo que aún no
se migró compile: `primarySoft` → `sage`, `textStrong` → `text`, `inverseAccent` → `primary`. `theme/index.ts` exporta
`colors` (`@deprecated`) armado con `lightColors` más `legacyColors`. Se retira en la fase de cierre (tarea T061).

### Reglas de contraste (se prueban en `theme-contrast.test.ts`)

| Par | Mínimo | Claro | Oscuro |
|---|---|---|---|
| `text` y `textMuted` sobre `background`, `surface`, `surfaceSoft` | 4,5 | 5,6–15,1 | 6,8–15,0 |
| `onPrimary` sobre `primary` | 4,5 | 9,1 | 9,2 |
| `primary` sobre `background`, `surface`, `sage` | 4,5 | 7,1–9,1 | 6,6–9,9 |
| `onHero` sobre `hero` y `heroShape` | 4,5 | 6,6–8,5 | 8,3–10,4 |
| `onHeroMuted` sobre `hero` y `heroShape` | 4,5 | 4,8–6,2 | 5,2–6,5 |
| `negative` sobre `background`, `surface`, `surfaceSoft` | 4,5 | 5,3–6,2 | 7,0–8,9 |
| `positive` sobre `background`, `surface`, `surfaceSoft` | 4,5 | 5,3–6,2 | 8,5–10,8 |
| `warningText` sobre `warningBackground` | 4,5 | 7,5 | 9,6 |
| `onInverse` sobre `inverse` | 4,5 | 11,9 | 15,0 |
| tinta de cada tono (`toneXInk`) sobre su fondo (ícono) | 3,0 | 5,8–6,3 | 7,5–7,9 |
| `border` sobre `background`, `surface` | 3,0 | 3,5–3,8 | 4,2–4,7 |
| `heroShape`, formas de fondo | solo decorativo | no lleva texto ni íconos | no lleva texto ni íconos |

## Medidas (`apps/mobile/src/theme/tokens.ts`)

| Token | Valor |
|---|---|
| `radius.leaf` | tarjeta de balance: esquinas grandes 34 dp (arriba a la izquierda y abajo a la derecha) y pequeñas 12 dp (las otras dos) |
| `radius.leafSmall` | botón «+»: 20 dp y 8 dp con la misma disposición |
| `radius.sheet` | lámina de contenido: 26 dp arriba, 0 abajo |
| `radius.card` | 24 dp (tarjetas de Ajustes y de otras pantallas) |
| `radius.control` | 16 dp (campos, avisos) |
| `radius.pill` | 999 (botón principal, chips, ítem activo de la barra) |
| `space` | 4, 8, 12, 16, 20, 24, 32 |
| `touch` | 48 dp mínimo (los chips de 34 dp de alto suman área de toque hasta 48) |
| `icon` | 20 dp en filas, 24 dp en la barra, 23 dp en el «+»; trazo 1,75 (2 en el «+») |
| sombra | solo dos: `heroShadow` (tarjeta de balance) y el «+»; el resto de las piezas va plano |

## Tipografía

| Uso | Letra | Tamaño / peso |
|---|---|---|
| Título de pantalla, subtítulo de sección | de identidad (Bricolage Grotesque) | 26 / SemiBold-Bold; 17 / SemiBold |
| Cifra del balance y monto del formulario | de identidad | 34 / Bold y 44 / Bold |
| Texto, campos, chips, filas | del sistema | 15 / 400-500 |
| Montos de las listas y de las tarjetas de cuenta | del sistema, cifras tabulares | 15 / 500 |
| Ayuda y etiquetas pequeñas | del sistema | 13 / 400 |

- La letra de identidad son **dos archivos** (SemiBold 600 y Bold 700, licencia OFL) incluidos dentro de la app con el
  plugin de `expo-font` en tiempo de compilación; no se descarga nada y no hay carga en ejecución (sin parpadeo de otra
  letra). Si no estuvieran, se usa la del sistema.
- Se comprueba al implementar que las cifras de la letra de identidad no «bailan» (cifras tabulares). Si no las tiene,
  la cifra del balance usa la del sistema.
- Todo respeta el tamaño de letra del sistema (`allowFontScaling`); la cifra del balance reduce su tamaño antes de cortarse.

## Íconos y tonos por categoría (`apps/mobile/src/ui/category-icons.ts`)

Se asocian por `slug` (nunca por el nombre visible). Los nombres de ícono son de lucide; se confirman al instalar la
versión y `category-icons.test.ts` avisa si alguno ya no existe.

| Gasto | Ícono | Tono | Ingreso | Ícono | Tono |
|---|---|---|---|---|---|
| `groceries` | `ShoppingCart` | arena | `salary` | `Banknote` | base |
| `dining` | `Utensils` | arena | `bonus` | `Award` | base |
| `shopping` | `ShoppingBag` | arena | `freelance` | `Laptop` | base |
| `gifts` | `Gift` | arena | `business` | `Store` | base |
| `entertainment` | `Clapperboard` | arena | `investments` | `TrendingUp` | base |
| `transport` | `Bus` | niebla | `gifts_received` | `HandHeart` | base |
| `vehicle` | `Car` | niebla | `refunds` | `Undo2` | base |
| `travel` | `Plane` | niebla | `other_income` | `CirclePlus` | base |
| `health` | `HeartPulse` | arcilla | | | |
| `personal_care` | `Scissors` | arcilla | **Otros** | | |
| `education` | `GraduationCap` | arcilla | transferencia | `ArrowLeftRight` | neutro |
| `pets` | `PawPrint` | arcilla | ajuste de saldo | `Scale` | neutro |
| `housing` | `House` | base | | | |
| `utilities` | `Zap` | base | | | |
| `home_family` | `Users` | base | | | |
| `subscriptions` | `Repeat` | base | | | |
| `fees_taxes` | `FileText` | base | | | |
| `other_expense` | `Ellipsis` | neutro | | | |

Pestañas: Inicio `House`, Movimientos `ReceiptText`, Cuentas `Wallet`, Ajustes `Settings`; botón central `Plus`. Cuentas
en Inicio: efectivo `Banknote`, billetera digital `Smartphone`, banco `Landmark`. Otros: `ChevronLeft` (volver),
`ChevronRight` (filas), `ArrowLeftRight` (transferir), `Mail` (correo sin verificar), `Leaf` (marca).

## Reservado para lo que viene

Según [docs/mapa-de-la-app.md](../../docs/mapa-de-la-app.md), el tono arena (`toneSand` / `toneSandInk`) será también la
marca de «dato sugerido por Saveria» cuando llegue el registro por IA. Esta feature no crea tokens para funciones que
aún no existen.

## Estados

La identidad visual no tiene ciclo de vida. Su único «cambio de estado» es de modo (claro ↔ oscuro) y es inmediato: el
hook `useTheme()` vuelve a dibujar las pantallas abiertas sin reiniciar la navegación ni perder lo escrito.
