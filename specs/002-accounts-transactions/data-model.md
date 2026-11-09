# Data Model: Cuentas y movimientos manuales

Extiende el modelo de la 001 (`specs/001-auth-onboarding/data-model.md`). Montos en
`numeric(19,4)` y como texto en el contrato; fechas-hora en `timestamptz` (UTC). Las decisiones
están en [research.md](research.md).

## PostgreSQL

### `accounts` (ampliada)

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | Generado por el cliente (idempotente) |
| `user_id` | uuid FK → `users.id` **on delete cascade** | |
| `name` | varchar(40) | 1–40 caracteres sin espacios sobrantes. Único entre las cuentas activas del usuario sin distinguir mayúsculas (FR-017) |
| `type` | enum `account_type`: `cash` \| `wallet` \| `bank` | **Nuevo**. La migración pone `cash` a las cuentas existentes ("Efectivo") |
| `currency` | char(3) | Del catálogo. Solo cambia si la cuenta no tiene movimientos vivos (FR-019) |
| `initial_balance` | numeric(19,4) | Puede ser 0 o negativo; máximo 12 dígitos enteros y los decimales de la moneda |
| `is_default` | boolean | Exactamente una entre las activas (FR-020). Marcar una desmarca las demás en la misma transacción |
| `archived_at` | timestamptz null | **Nuevo**. No se puede archivar la cuenta por defecto (FR-021) |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | `updated_at` viene del cliente (LWW). `deleted_at` no se usa en esta feature: las cuentas no se borran (FR-022) |

**Índices**:

- `accounts_one_default_per_user_idx` (existe): único parcial `(user_id) WHERE is_default AND deleted_at IS NULL`. Se agrega `AND archived_at IS NULL`.
- `accounts_active_name_idx` (nuevo): único parcial `(user_id, lower(name)) WHERE archived_at IS NULL AND deleted_at IS NULL`.

**Reglas del caso de uso** (`save-account`; viven una sola vez en
`packages/shared/src/rules/accounts.ts` y las usan el servidor y el teléfono):

- Máximo 20 cuentas activas por usuario (FR-023).
- No se puede archivar si `is_default`; tampoco quitar `is_default` sin marcar otra (siempre debe
  quedar una).
- Archivar con saldo distinto de cero está permitido (el aviso es de la app).
- Reactivar (`archived_at` → null) cumple las mismas reglas que crear: nombre único entre las
  activas y máximo 20 activas (FR-021).

### `transactions` (nueva, sincronizable)

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | Generado por el cliente (idempotente) |
| `user_id` | uuid FK → `users.id` **on delete cascade** | |
| `type` | enum `transaction_type`: `expense` \| `income` \| `transfer` \| `adjustment` | |
| `account_id` | uuid FK → `accounts.id` | Cuenta del movimiento; en transferencias, la de **origen**. Debe ser del mismo usuario |
| `amount` | numeric(19,4) | `expense`, `income`, `transfer`: > 0. `adjustment`: ≠ 0, con signo. Máx. 12 dígitos enteros y los decimales de la moneda (FR-005) |
| `currency` | char(3) | Igual a la moneda de `account_id` (FR-006) |
| `to_account_id` | uuid FK → `accounts.id` null | Solo en `transfer`; distinta de `account_id` y del mismo usuario |
| `to_amount` | numeric(19,4) null | Solo en `transfer`; > 0. Si las monedas son iguales, igual a `amount` |
| `to_currency` | char(3) null | Solo en `transfer`; igual a la moneda de `to_account_id` |
| `category_slug` | varchar(32) null | Obligatoria en `expense`/`income` y del tipo correcto según el catálogo; nula en `transfer`/`adjustment` (FR-003, FR-028, FR-032) |
| `description` | varchar(120) null | Opcional |
| `occurred_on` | date | Día local del movimiento. No más de 1 día después del "hoy" UTC del servidor (FR-007) |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | `updated_at` del cliente (LWW). Borrar = `deleted_at` (borrado lógico) |

**Restricciones (CHECK)**: las reglas por tipo de la tabla anterior (campos de transferencia
presentes solo en `transfer`, categoría solo en gasto/ingreso, signo del monto).

**Índices**:

- `transactions_user_occurred_idx`: `(user_id, occurred_on DESC, created_at DESC) WHERE deleted_at IS NULL` (historial).
- `transactions_account_idx`: `(account_id) WHERE deleted_at IS NULL` y `transactions_to_account_idx`: `(to_account_id) WHERE deleted_at IS NULL` (saldos, regla de moneda).

**Llaves foráneas a `accounts`**: sin `cascade` (las cuentas no se borran); el borrado del usuario
cae por `user_id` en ambas tablas.

**Saldo de una cuenta** (calculado, nunca guardado; research §7):

```text
saldo = initial_balance
      + Σ amount     (income,     account_id = cuenta)
      − Σ amount     (expense,    account_id = cuenta)
      + Σ amount     (adjustment, account_id = cuenta)   -- con signo
      − Σ amount     (transfer,   account_id = cuenta)
      + Σ to_amount  (transfer,   to_account_id = cuenta)
  sobre filas con deleted_at IS NULL
```

### Borrado de la cuenta del usuario (FR-041)

`transactions.user_id` y `accounts.user_id` en cascada desde `users`. El orden de la cascada no
importa porque las dos tablas cuelgan de `users`.

## Base local del teléfono (SQLite cifrado, por usuario)

| Tabla | Cambio |
|---|---|
| `accounts` | Se agregan `type`, `archived_at`, `initial_balance_e4` (entero), `sync_state` (`pending` \| `synced` \| `rejected`) y `sync_error` |
| `transactions` | **Nueva**, con los mismos campos que el servidor (fechas como texto ISO, `occurred_on` como `YYYY-MM-DD`) más `amount_e4`, `to_amount_e4` (enteros en diezmilésimas), `sync_state` y `sync_error` |
| `outbox` | Sin cambios de esquema. Nuevas entidades `account` y `transaction`, operaciones `upsert` y `delete` |

- Los montos se guardan como texto (canónico) y como entero en diezmilésimas para sumar con
  exactitud (research §5).
- Índices locales: `(occurred_on DESC, created_at DESC)` y `(account_id)`, `(to_account_id)`.
- Un registro creado o cambiado en el teléfono queda en `pending`; pasa a `synced` cuando el
  servidor responde `2xx` y a `rejected` (con `sync_error`) ante un `4xx` sin arreglo (FR-037).
- El borrado de la cuenta del usuario ya elimina el archivo completo (feature 001).

## Catálogo compartido (`packages/shared`)

| Archivo | Contenido |
|---|---|
| `src/catalog/categories.ts` | 18 categorías de gasto y 8 de ingreso: `slug`, `name`, `type` (de `docs/vision-fase-0.md`) |
| `src/catalog/currencies.ts` | COP pasa a `decimals: 0` (research §6) |
| `src/money/` | `parseAmount` (entrada colombiana → decimal normalizado), `toE4` / `fromE4` con `BigInt`, `formatAmount` por moneda |
| `src/validation/account.ts`, `src/validation/transaction.ts` | Reglas Zod compartidas por la app y el servidor |
| `src/rules/accounts.ts` | Reglas que dependen de las demás cuentas: nombre único entre activas, máximo 20 activas, siempre una cuenta por defecto, no archivar la cuenta por defecto, moneda bloqueada con movimientos |

## Estados

```text
Cuenta:      activa ──archivar──► archivada ──reactivar──► activa
             (la cuenta por defecto no se archiva)

Movimiento:  vivo ──borrar──► borrado (deleted_at) ──deshacer (≥5 s)──► vivo

Envío local: pending ──2xx──► synced
             pending ──4xx──► rejected ──corregir──► pending
             synced  ──editar/borrar──► pending
```
