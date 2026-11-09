---

description: "Tareas de la feature 002-accounts-transactions"
---

# Tasks: Cuentas y movimientos manuales

**Input**: Documentos de diseño en `specs/002-accounts-transactions/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/openapi.yaml](contracts/openapi.yaml),
[quickstart.md](quickstart.md)

**Tests**: OBLIGATORIAS por la Constitución VIII. Cada escenario de aceptación tiene al menos una
prueba según la matriz de `plan.md`. Dentro de cada historia, las pruebas se escriben primero y
deben fallar antes de implementar.

**Organization**: Tareas agrupadas por historia de usuario para implementarlas y probarlas por
separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos y sin dependencias pendientes)
- **[Story]**: historia de usuario a la que pertenece (US1…US6)

## Path Conventions

- Backend: `apps/api/src/`, pruebas en `apps/api/tests/{unit,contract,integration}/`
- App: `apps/mobile/src/` (rutas de Expo Router en `apps/mobile/src/app/`), pruebas en
  `apps/mobile/tests/`
- Compartido: `packages/shared/src/`, pruebas en `packages/shared/tests/`
- Comandos: Bun (`bun`, `bunx`). Bun no está en el PATH fijo: `export PATH="$HOME/.bun/bin:$PATH"`.
  Las pruebas de integración necesitan `docker compose up -d postgres redis`.
- Montos: siempre texto decimal o enteros `BigInt`; nunca `number` para dinero (Constitución IV).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pasar el código al contrato acumulativo de la 002 sin romper la 001

- [X] T001 Apuntar al contrato de la 002 (`specs/002-accounts-transactions/contracts/openapi.yaml`) en `apps/api/src/app.ts` (lo que sirve `/docs/openapi.yaml`), en `apps/api/tests/support/contract.ts` y en el script `api:types` de `apps/mobile/package.json`; regenerar `apps/mobile/src/api/schema.d.ts` con `bun run --cwd apps/mobile api:types`
- [X] T002 Correr `bun test --cwd apps/api` y `bun run --cwd apps/mobile test` y confirmar que las pruebas de la 001 siguen en verde contra el contrato nuevo (346 api, 189 mobile) antes de seguir

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Catálogo, dinero exacto, validaciones, esquema de datos y cola de cambios que usan
todas las historias

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase

### Compartido

- [X] T003 [P] Pruebas en `packages/shared/tests/categories.test.ts`: hay exactamente 18 categorías `expense` y 8 `income`; los slugs son únicos y coinciden con el enum `CategorySlug` del contrato; `categoriesFor('expense')` solo devuelve las de gasto
- [X] T004 [P] Crear `packages/shared/src/catalog/categories.ts` con las 26 categorías de `docs/vision-fase-0.md` (`slug`, `name` en español, `type: 'expense' | 'income'`), los tipos `CategorySlug` y `CategoryType`, `CATEGORIES`, `categoriesFor(type)` y `isCategoryOfType(slug, type)`; exportar desde `packages/shared/src/index.ts`
- [X] T005 [P] Cambiar COP a `decimals: 0` en `packages/shared/src/catalog/currencies.ts` (research §6) y actualizar la expectativa en `packages/shared/tests/validation.test.ts` (0 decimales para CLP, COP y PYG)
- [X] T006 [P] Pruebas en `packages/shared/tests/money.test.ts`: `parseAmount("18.000", 'COP')` → `"18000"`; `parseAmount("12,50", 'USD')` → `"12.50"`; `parseAmount("18000,5", 'COP')` → error de decimales; más de 12 dígitos enteros → error; `toE4("18000")` → `180000000n`; `fromE4(-50000000n)` → `"-5000"`; `formatAmount("18000", 'COP')` → `"$ 18.000"`; ida y vuelta texto ↔ `BigInt` sin pérdida con 4 decimales; ninguna función usa `number` para el monto
- [X] T007 [P] Crear `packages/shared/src/money/index.ts` (`parseAmount(input, currency)`, `toE4(text): bigint`, `fromE4(value: bigint): string`, `formatAmount(text, currency)`, `compareAmounts`), con `BigInt` y sin punto flotante (research §5); exportar desde `packages/shared/src/index.ts`
- [X] T008 [P] Pruebas en `packages/shared/tests/account-validation.test.ts` y `packages/shared/tests/transaction-validation.test.ts` con las reglas de `data-model.md`: nombre `"1–40 caracteres sin espacios sobrantes"`; `type` en `cash | wallet | bank`; saldo inicial "Puede ser 0 o negativo; máximo 12 dígitos enteros y los decimales de la moneda"; `expense`/`income` exigen `amount > 0` y `categorySlug` del tipo correcto y sin campos `to*`; `transfer` exige `toAccountId` distinta de `accountId`, `toAmount > 0`, `toCurrency` y no lleva categoría; `adjustment` "≠ 0, con signo", sin categoría ni `to*`; `description` "varchar(120)"; `occurredOn` hoy o pasada (con una función `today` inyectable)
- [X] T009 Crear `packages/shared/src/validation/account.ts` (`accountInputSchema`) y `packages/shared/src/validation/transaction.ts` (`transactionInputSchema` con `superRefine` por tipo y `occurredOn` comparada con un `today` inyectable); los mensajes en español; exportar desde `packages/shared/src/index.ts`
- [X] T010 [P] Pruebas en `packages/shared/tests/account-rules.test.ts` de `checkAccountChange({ next, previous, others, hasTransactions })`: nombre repetido entre activas sin distinguir mayúsculas → error en `name` (una archivada no cuenta); 21.ª cuenta activa → error; quitar `isDefault` a la única cuenta por defecto → error; archivar la cuenta por defecto → error en `archivedAt`; cambiar `currency` con `hasTransactions` → error en `currency`; archivar con saldo distinto de cero → sin error; reactivar (`archivedAt` de fecha a `null`) una cuenta cuyo nombre ya usa otra activa → error en `name` que pide renombrarla; reactivar con 20 activas → error que pide archivar otra; los mensajes en español
- [X] T011 Crear `packages/shared/src/rules/accounts.ts` con `checkAccountChange` (función pura, sin acceso a base de datos: recibe las demás cuentas del usuario y devuelve `Record<campo, mensaje>` vacío si todo está bien) y `MAX_ACTIVE_ACCOUNTS = 20`; exportar desde `packages/shared/src/index.ts`. Es la **única** implementación de estas reglas: el servidor (T039) y el teléfono (T041) la llaman y no las reescriben (Constitución I, research §9)

### Backend: esquema y repositorios

- [X] T012 Ampliar `apps/api/src/infrastructure/db/schema.ts` según `data-model.md`: enum `account_type` (`cash`, `wallet`, `bank`) y columna `accounts.type` "La migración pone `cash` a las cuentas existentes"; `accounts.archived_at` (timestamptz null); índice `accounts_one_default_per_user_idx` con `AND archived_at IS NULL`; índice nuevo `accounts_active_name_idx` "único parcial `(user_id, lower(name)) WHERE archived_at IS NULL AND deleted_at IS NULL`"; tabla `transactions` con enum `transaction_type`, `amount`/`to_amount` `numeric(19,4)`, `currency`/`to_currency` `char(3)`, `category_slug` `varchar(32)`, `description` `varchar(120)`, `occurred_on` `date`, `user_id` on delete cascade, FKs a `accounts` sin cascade, las CHECK por tipo y los índices `transactions_user_occurred_idx`, `transactions_account_idx`, `transactions_to_account_idx`; generar la migración con `bun run --cwd apps/api db:generate` y revisar el SQL en `apps/api/drizzle/`
- [X] T013 [P] Ampliar `Account` y crear `Transaction` en `apps/api/src/domain/entities.ts`; ampliar `AccountRepository` (`upsert`, `findByIdForUser`, `listActiveByUser`, `countActiveByUser`, `clearDefaultExcept`, `hasTransactions`) y crear `TransactionRepository` (`upsert`, `findById`, `balanceOf(accountId)` con la fórmula de `data-model.md`) en `apps/api/src/application/ports/repositories.ts`; agregar los dobles en memoria en `apps/api/tests/support/in-memory.ts`
- [X] T014 Implementar los repositorios en `apps/api/src/infrastructure/db/repositories/account-repository.ts` y `apps/api/src/infrastructure/db/repositories/transaction-repository.ts` (nuevo; `balanceOf` suma `numeric` en SQL, nunca en JS) y registrarlos en `apps/api/src/infrastructure/db/repositories/index.ts` y `apps/api/src/container.ts`
- [X] T015 [P] Pruebas de integración de repositorios en `apps/api/tests/integration/repositories.test.ts` (ampliar): la migración deja "Efectivo" con `type = cash`; `balanceOf` con ingresos, gastos, ajustes con signo y transferencias de entrada y salida, ignorando `deleted_at`; el índice de nombre activo rechaza "nequi" si existe "Nequi" activa y lo permite si está archivada

### App: base local y cola de cambios

- [X] T016 Ampliar `apps/mobile/src/db/schema.ts` según `data-model.md` (base local): `accounts` + `type`, `archived_at`, `initial_balance_e4`, `sync_state` (`pending | synced | rejected`), `sync_error`; tabla nueva `transactions` con los campos del servidor más `amount_e4`, `to_amount_e4`, `sync_state`, `sync_error` e índices `(occurred_on DESC, created_at DESC)`, `(account_id)`, `(to_account_id)`; generar con `bun run --cwd apps/mobile db:generate`. La migración debe dar valores por defecto a las filas existentes (`type = 'cash'`, `sync_state = 'synced'`, `initial_balance_e4` calculado desde `initial_balance`) para no romper los teléfonos que ya tienen la 001 (riesgo de `plan.md`)
- [X] T017 [P] Prueba en `apps/mobile/tests-sqlite/migrations.test.ts` (SQLite real de Bun; Jest usa una base simulada): una base creada con la migración de la 001 que tiene "Efectivo" y el perfil se migra sin perder datos y queda con `type = 'cash'` y `sync_state = 'synced'`
- [X] T018 [P] Pruebas en `apps/mobile/tests/outbox.test.ts` y `apps/mobile/tests/http-sender.test.ts` (ampliar): (a) compactar: encolar `upsert` de la entidad X cuando hay otro `upsert`/`delete` pendiente de X que aún no se está enviando reemplaza al anterior; un cambio en vuelo no se toca; (b) `onRejected(item, body)` se llama ante un `4xx` que no es 401, 409 ni 429, también para un `DELETE`; el ítem se descarta y la cola sigue con el siguiente; (c) `onSent(item)` se llama ante un `2xx`
- [X] T019 Implementar en `apps/mobile/src/outbox/outbox.ts` la compactación por `entity` + `entityId` (nuevo método del store `replacePending(change, exceptId)`, que conserva el lugar en la cola del cambio reemplazado para que una cuenta siga saliendo antes que sus movimientos) y en `apps/mobile/src/outbox/http-sender.ts` las opciones `onRejected` y `onSent` (research §4); conectarlas en `apps/mobile/src/outbox/user-outbox.ts` a un despachador por `entity` que las features registran
- [X] T020 Crear el almacén local `apps/mobile/src/features/accounts/local-accounts.ts` (leer, guardar, marcar `sync_state`) y `apps/mobile/src/features/transactions/local-transactions.ts` (guardar con `amount_e4`, borrar lógico, restaurar, marcar `sync_state`, `balances()` con la fórmula de `data-model.md` sumando `amount_e4`/`to_amount_e4` en SQL, e historial paginado de 50 en 50 con filtro opcional por cuenta)
- [X] T021 [P] Pruebas en `apps/mobile/tests-sqlite/local-ledger.test.ts` (SQLite real de Bun, `bun run --cwd apps/mobile test:sqlite`): `balances()` coincide al centavo con la fórmula para gastos, ingresos, transferencias en dos monedas y ajustes, e ignora los borrados (SC-003); el historial viene agrupable por día y ordenado por `occurred_on DESC, created_at DESC`; el filtro por cuenta incluye las transferencias que entran

**Checkpoint**: base lista; las pruebas de la 001 siguen en verde y las nuevas de esta fase pasan

---

## Phase 3: User Story 1 - Registrar un gasto o un ingreso (Priority: P1) 🎯 MVP

**Goal**: Anotar gastos e ingresos en máximo 3 toques más el monto, con y sin conexión

**Independent Test**: Con solo "Efectivo", registrar un gasto y un ingreso, con y sin conexión, y verlos guardados (escenarios 1.1–1.7)

### Tests for User Story 1 ⚠️

- [X] T022 [P] [US1] Pruebas unitarias en `apps/api/tests/unit/save-transaction.test.ts` (gasto e ingreso): crea con el id del cliente; monto `0`, negativo, con más de 12 dígitos enteros o con decimales que la moneda no permite → `validation_error` con `fields.amount`; categoría de ingreso en un gasto → `validation_error`; `currency` distinta de la de la cuenta → `validation_error`; cuenta de otro usuario → `validation_error` en `accountId`; fecha más de 1 día después del hoy UTC → `validation_error`; usuario sin moneda principal → `primary_currency_required`; LWW: mismo `updatedAt` o más viejo → `conflict` con la versión guardada; id de un movimiento de otro usuario → `not_found`
- [X] T023 [P] [US1] Pruebas de contrato en `apps/api/tests/contract/transactions-us1.test.ts` para `PUT /v1/transactions/{id}` (200, 400, 401, 404, 409, 422)
- [X] T024 [P] [US1] Pruebas de integración en `apps/api/tests/integration/us1-transactions.test.ts`: crear gasto e ingreso por HTTP en "Efectivo"; el mismo `PUT` dos veces deja una sola fila (1.7, FR-036); el saldo de "Efectivo" en el servidor refleja ambos
- [X] T025 [P] [US1] Pruebas de la app en `apps/mobile/tests/us1-record.test.tsx`: el formulario abre con "gasto", la cuenta por defecto y la fecha de hoy (1.1); monto + categoría + "Guardar" registra en 3 toques (1.2, SC-001); "ingreso" muestra solo las 8 de ingreso (1.3); sin red se guarda, aparece en Inicio y queda en el outbox, y al volver la red se envía (1.4); sin monto, con `0` o sin categoría no se guarda y dice qué falta (1.5); en COP no acepta decimales y en USD sí 2 (1.6); un rechazo del servidor deja el movimiento con "no se pudo guardar" y el motivo (FR-037)

### Implementation for User Story 1

- [X] T026 [US1] Implementar `apps/api/src/application/use-cases/save-transaction.ts`: el único caso de uso de movimientos (Constitución I, research §10); valida con `transactionInputSchema` de `@saveria/shared`, comprueba cuentas del usuario y monedas, aplica LWW por `updatedAt` y guarda `updated_at` = el del cliente; deja los tipos `transfer` y `adjustment` listos para US5 y US6 (la validación compartida ya los cubre)
- [X] T027 [US1] Crear `apps/api/src/interfaces/http/routes/transactions.ts` con `PUT /v1/transactions/:id` (200, 409 con el registro del servidor, errores según el contrato) y montarla en `apps/api/src/app.ts` bajo `/v1/transactions` con el middleware de autenticación; agregar `toTransactionDto` en `apps/api/src/application/dto.ts`
- [X] T028 [US1] Implementar `apps/mobile/src/features/transactions/transaction-service.ts`: `record(input)` genera el UUID con `expo-crypto`, normaliza el monto con `parseAmount`, valida con `transactionInputSchema`, guarda local (`sync_state = pending`), encola `PUT /v1/transactions/{id}` con el registro completo y envía si hay red; registra en el despachador del outbox `onSent` → `synced` y `onRejected` → `rejected` con el mensaje del servidor; `onConflict` adopta la versión del servidor
- [X] T029 [P] [US1] Crear la pantalla `apps/mobile/src/app/(app)/transactions/new.tsx`: selector gasto/ingreso, monto con foco y teclado numérico, cuadrícula de categorías del tipo elegido (`categoriesFor`), chips de cuenta (cuentas activas, la de por defecto elegida) y de fecha (hoy; sin fechas futuras), descripción opcional `maxLength 120`, "Guardar"; mensajes de error por campo
- [X] T030 [US1] Agregar en `apps/mobile/src/app/(app)/home.tsx` el botón "+" que abre `transactions/new` (solo si hay `primaryCurrency`, FR-008) y una lista simple de los **últimos 5 movimientos** (más reciente primero, con monto y moneda, categoría, cuenta y fecha) leída del historial local de T020, para que el gasto recién guardado se vea en Inicio desde esta historia (escenario 1.4); cada movimiento con `sync_state = rejected` muestra la marca "no se pudo guardar" con el motivo. US2 (T033) amplía esta pantalla

**Checkpoint**: se pueden anotar gastos e ingresos de verdad (MVP de la feature)

---

## Phase 4: User Story 2 - Ver el historial y el saldo (Priority: P1)

**Goal**: Saldo de cada cuenta en su moneda y movimientos agrupados por día, con filtro por cuenta

**Independent Test**: Tras varios movimientos en dos cuentas, cada saldo es el saldo inicial más ingresos menos gastos, y el historial los muestra en orden (escenarios 2.1–2.6)

### Tests for User Story 2 ⚠️

- [X] T031 [P] [US2] Pruebas de la app en `apps/mobile/tests/us2-history.test.tsx`: saldo 100.000 + 50.000 − 30.000 = 120.000 (2.1); agrupado por día y del más reciente al más antiguo con monto, moneda, categoría, cuenta y descripción (2.2); filtro por cuenta incluye las transferencias (2.3); con cuentas COP y USD no hay total (2.4, FR-012); con todas en la moneda principal sí hay total y las archivadas no suman (2.5, FR-013); con la red apagada se ve todo (2.6); un saldo negativo se muestra destacado (FR-014)

### Implementation for User Story 2

- [X] T032 [US2] Implementar `apps/mobile/src/features/transactions/ledger.ts`: hook o selector que expone saldos por cuenta (`balances()` de T020 formateados con `formatAmount`), el total solo cuando todas las cuentas activas están en la moneda principal y sin contar archivadas, y el historial paginado agrupado por día
- [X] T033 [US2] Ampliar `apps/mobile/src/app/(app)/home.tsx`: saludo (se conserva), tarjetas de saldo por cuenta activa (negativo en rojo), total cuando aplique, la lista de últimos movimientos de T030 agrupada por día y enlace "Ver todo" al historial completo
- [X] T034 [P] [US2] Crear `apps/mobile/src/app/(app)/transactions/index.tsx`: historial completo con lista virtualizada por secciones (día), paginación de 50 en 50 y filtro por cuenta (research §11)

**Checkpoint**: US1 + US2 = anotar y ver el resultado (el hábito diario)

---

## Phase 5: User Story 3 - Gestionar cuentas (Priority: P1)

**Goal**: Crear, renombrar, cambiar la cuenta por defecto y archivar cuentas, también sin conexión

**Independent Test**: Crear "Nequi" en COP con saldo inicial, marcarla por defecto y ver que el siguiente gasto la trae preseleccionada (escenarios 3.1–3.9)

### Tests for User Story 3 ⚠️

- [X] T035 [P] [US3] Pruebas unitarias en `apps/api/tests/unit/save-account.test.ts`: crea con el id del cliente; nombre repetido entre activas sin distinguir mayúsculas → `validation_error` en `name` (3.5); 21.ª cuenta activa → `validation_error` (FR-023); `isDefault = true` desmarca las demás en la misma transacción (3.3); quitar `isDefault` a la única cuenta por defecto → `validation_error`; archivar la cuenta por defecto → `validation_error` (3.7); archivar con saldo distinto de cero → permitido (3.6); cambiar `currency` con movimientos vivos como origen o como destino → `validation_error` (3.8, FR-019); reactivar con un nombre ya usado por otra activa o con 20 activas → `validation_error` (FR-021, comprobado con las cuentas del servidor); sin moneda principal → `primary_currency_required`; LWW → `conflict`; id de otro usuario → `not_found`
- [X] T036 [P] [US3] Pruebas de contrato en `apps/api/tests/contract/accounts-us3.test.ts` para `PUT /v1/accounts/{id}` (200, 400, 401, 404, 409, 422)
- [X] T037 [P] [US3] Pruebas de integración en `apps/api/tests/integration/us3-accounts.test.ts`: crear "Nequi" con saldo inicial 80.000 y marcarla por defecto deja "Efectivo" sin marca; renombrar; archivar y reactivar; el índice único parcial nunca falla aunque lleguen primero el `PUT` de la nueva cuenta por defecto y después el de la anterior
- [X] T038 [P] [US3] Pruebas de la app en `apps/mobile/tests/us3-accounts.test.tsx`: crear "Nequi" con moneda principal preseleccionada (3.1, 3.2); marcarla por defecto cambia el chip del formulario de registro (3.3); renombrar se ve en los movimientos (3.4); nombre repetido (3.5); archivar avisa el saldo y la mueve a "cuentas archivadas" (3.6); la cuenta por defecto pide elegir otra antes (3.7); la moneda queda bloqueada con movimientos (3.8); crear sin red queda en el outbox (3.9); reactivar una "Nequi" archivada cuando ya existe otra "Nequi" activa pide renombrarla y con 20 activas pide archivar otra (FR-021); una cuenta creada sin red que el servidor rechaza sigue en la lista con "no se pudo guardar" y el motivo, y al corregirla se vuelve a enviar (FR-037)

### Implementation for User Story 3

- [X] T039 [US3] Implementar `apps/api/src/application/use-cases/save-account.ts` (valida con `accountInputSchema` y `checkAccountChange` de `@saveria/shared` usando las cuentas del usuario leídas del repositorio, sin reescribir las reglas; LWW y "marcar una desmarca las demás" en una transacción) y adaptar `apps/api/src/application/use-cases/create-default-account.ts` para que use el nuevo `upsert` y ponga `type = 'cash'`
- [X] T040 [US3] Crear `apps/api/src/interfaces/http/routes/accounts.ts` con `PUT /v1/accounts/:id` y montarla en `apps/api/src/app.ts`; agregar `toAccountRecordDto` en `apps/api/src/application/dto.ts`
- [X] T041 [US3] Implementar `apps/mobile/src/features/accounts/account-service.ts`: `create`, `update` (renombrar, tipo, saldo inicial, moneda solo sin movimientos), `setDefault` (desmarca la anterior localmente y encola la cuenta nueva), `archive` (rechaza la cuenta por defecto), `unarchive`; antes de guardar valida con `accountInputSchema` y `checkAccountChange` de `@saveria/shared` usando las cuentas locales (no reescribe ninguna regla); cada cambio se guarda local, se encola como `PUT /v1/accounts/{id}` y se marca `synced`/`rejected` con el despachador
- [X] T042 [P] [US3] Crear las pantallas `apps/mobile/src/app/(app)/accounts/index.tsx` (activas con saldo, enlace a archivadas, "Nueva cuenta"), `apps/mobile/src/app/(app)/accounts/archived.tsx`, `apps/mobile/src/app/(app)/accounts/new.tsx` y `apps/mobile/src/app/(app)/accounts/[id].tsx` (editar, "Cuenta por defecto", "Archivar" con aviso del saldo, "Reactivar" que muestra el error de nombre o de límite y deja renombrar ahí mismo); en la lista, cada cuenta con `sync_state = rejected` muestra "no se pudo guardar" con el motivo; en los textos decir "cuenta de dinero" para no confundirla con la cuenta del usuario

**Checkpoint**: P1 completas; Saveria ya separa el dinero por cuentas

---

## Phase 6: User Story 4 - Editar y borrar un movimiento (Priority: P2)

**Goal**: Corregir monto, categoría, cuenta, fecha o descripción, y borrar con "Deshacer"

**Independent Test**: Editar el monto de un gasto y borrar otro; los saldos se recalculan y el borrado desaparece, también sin conexión (escenarios 4.1–4.6)

### Tests for User Story 4 ⚠️

- [ ] T043 [P] [US4] Pruebas unitarias en `apps/api/tests/unit/delete-transaction.test.ts`: marca `deleted_at`; repetir → mismo resultado; id desconocido → éxito sin crear nada; `updatedAt` más viejo → `conflict`; id de otro usuario → `not_found`; un `PUT` posterior con `deletedAt: null` lo restaura (research §3)
- [ ] T044 [P] [US4] Pruebas de contrato en `apps/api/tests/contract/transactions-us4.test.ts` para `DELETE /v1/transactions/{id}` (204, 400, 401, 404, 409)
- [ ] T045 [P] [US4] Pruebas de integración en `apps/api/tests/integration/us4-edit-delete.test.ts`: editar el monto de 18.000 a 20.000 baja el saldo 2.000 más (4.1); mover a otra cuenta de la misma moneda mueve el saldo (4.2); borrar devuelve el saldo (4.4); restaurar lo vuelve a contar (4.5)
- [ ] T046 [P] [US4] Pruebas de la app en `apps/mobile/tests/us4-edit-delete.test.tsx`: editar recalcula saldos (4.1, 4.2); mover a una cuenta de otra moneda pide el monto en la nueva moneda (4.3, FR-025); borrar quita al instante y muestra "Deshacer" ≥ 5 s (4.4); "Deshacer" restaura (4.5); sin red, editar y borrar se aplican y la cola compactada envía solo el estado final (4.6, caso límite); al editar un movimiento de una cuenta archivada, esa cuenta sigue en el selector (caso límite); un borrado rechazado por el servidor vuelve a mostrar el movimiento con "no se pudo borrar" y deja reintentar (FR-037)

### Implementation for User Story 4

- [ ] T047 [US4] Implementar `apps/api/src/application/use-cases/delete-transaction.ts` (reglas de T043) y agregar `DELETE /v1/transactions/:id` (204) en `apps/api/src/interfaces/http/routes/transactions.ts`
- [ ] T048 [US4] Agregar `update`, `remove` y `restore` en `apps/mobile/src/features/transactions/transaction-service.ts`: `update` encola el `PUT` completo; `remove` hace borrado lógico local y encola `DELETE` con `updatedAt`; `restore` encola `PUT` con `deletedAt: null` y un `updatedAt` más nuevo; si el servidor rechaza un `DELETE`, `onRejected` quita el borrado local (`deleted_at = null`), marca el movimiento `rejected` con "no se pudo borrar" y el motivo, y ofrece reintentar el borrado
- [ ] T049 [P] [US4] Crear `apps/mobile/src/app/(app)/transactions/[id].tsx` (mismo formulario que `new.tsx`, con los valores cargados; el selector de cuenta incluye siempre la cuenta actual del movimiento aunque esté archivada; al cambiar a una cuenta de otra moneda vacía el monto y lo pide de nuevo; botón "Borrar") y un aviso inferior reutilizable `apps/mobile/src/features/transactions/UndoSnackbar.tsx` visible 5 s con "Deshacer"

**Checkpoint**: los errores al registrar rápido se pueden corregir

---

## Phase 7: User Story 5 - Transferir entre cuentas (Priority: P2)

**Goal**: Mover dinero entre cuentas sin que cuente como gasto ni ingreso, también entre monedas

**Independent Test**: Transferir 100.000 COP de "Bancolombia" a "Nequi": uno baja, el otro sube y ningún gasto ni ingreso cambia (escenarios 5.1–5.5)

### Tests for User Story 5 ⚠️

- [ ] T050 [P] [US5] Pruebas unitarias en `apps/api/tests/unit/save-transaction-transfer.test.ts`: misma cuenta de origen y destino → `validation_error`; `toCurrency` distinta de la moneda de `toAccountId` → `validation_error`; con categoría → `validation_error` (FR-028); misma moneda con `toAmount` distinto de `amount` → `validation_error`; cuenta de destino de otro usuario → `validation_error`
- [ ] T051 [P] [US5] Pruebas de integración en `apps/api/tests/integration/us5-transfers.test.ts`: 100.000 COP de una cuenta a otra mueven ambos saldos en una sola fila (5.1); 10 USD → 40.000 COP (5.3); borrarla devuelve los dos saldos a la vez (5.5, FR-030)
- [ ] T052 [P] [US5] Pruebas de la app en `apps/mobile/tests/us5-transfer.test.tsx`: no pide categoría (5.2); con monedas distintas pide el monto que sale y el que entra (5.3); no deja elegir la misma cuenta (5.4); aparece una sola vez en el historial general y en el filtro de cada cuenta (5.1, 2.3); editar o borrar cambia los dos saldos juntos (5.5)

### Implementation for User Story 5

- [ ] T053 [US5] Completar las reglas de `transfer` en `apps/api/src/application/use-cases/save-transaction.ts` (cuenta de destino del usuario, `to_currency` = moneda de la cuenta de destino)
- [ ] T054 [US5] Agregar `transfer(input)` en `apps/mobile/src/features/transactions/transaction-service.ts` (si las monedas son iguales, `toAmount = amount`) y crear `apps/mobile/src/app/(app)/transfer.tsx` (origen, destino sin la de origen, monto y, si las monedas difieren, el segundo monto); entrada desde el "+" de Inicio y desde cada cuenta

**Checkpoint**: las cuentas no se descuadran al mover dinero entre ellas

---

## Phase 8: User Story 6 - Ajustar el saldo (Priority: P3)

**Goal**: Corregir el saldo con un movimiento de ajuste, sin tocar el historial

**Independent Test**: Una cuenta muestra 120.000 y el usuario dice que tiene 115.000; se crea un ajuste de −5.000 (escenarios 6.1–6.4)

### Tests for User Story 6 ⚠️

- [ ] T055 [P] [US6] Pruebas unitarias en `apps/api/tests/unit/save-transaction-adjustment.test.ts`: ajuste negativo y positivo válidos; monto `0` → `validation_error`; con categoría o campos `to*` → `validation_error` (FR-032)
- [ ] T056 [P] [US6] Pruebas de la app en `apps/mobile/tests/us6-adjust.test.tsx`: saldo 120.000 y real 115.000 → ajuste de −5.000 y saldo 115.000 (6.1); el ajuste se distingue en el historial y no lleva categoría (6.2); real igual al actual → no crea nada (6.3); borrarlo devuelve el saldo anterior (6.4)

### Implementation for User Story 6

- [ ] T057 [US6] Agregar `adjustTo(accountId, realBalanceText)` en `apps/mobile/src/features/transactions/transaction-service.ts` (diferencia exacta con `toE4`/`fromE4`; si es cero no crea nada) y crear `apps/mobile/src/app/(app)/accounts/[id]/adjust.tsx` (saldo actual, campo "saldo real", vista previa de la diferencia)

**Checkpoint**: las seis historias funcionan por separado

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cierre de la feature

- [ ] T058 [P] Ampliar `apps/api/tests/integration/logs-redaction.test.ts` (FR-040, SC-006): durante `PUT /v1/accounts`, `PUT` y `DELETE /v1/transactions` la salida de pino no contiene los montos (`18000`, `80000`) ni la descripción enviada
- [ ] T059 [P] Ampliar `apps/api/tests/integration/isolation.test.ts` (FR-039): el usuario A no puede crear, editar ni borrar cuentas o movimientos de B (404) ni usar una cuenta de B en un movimiento (400)
- [ ] T060 [P] Ampliar `apps/api/tests/integration/us4-delete.test.ts` de la 001 (FR-041): borrar la cuenta del usuario borra también sus cuentas y movimientos
- [ ] T061 [P] Prueba de rendimiento en `apps/mobile/tests/ledger-performance.test.ts` (SC-004): con 5.000 movimientos sembrados en una base de prueba, `balances()` y la primera página del historial responden en menos de 1 s; y un script de siembra solo para desarrollo en `apps/mobile/src/dev/seed-transactions.ts` para el paso 15 del quickstart
- [ ] T062 [P] Pruebas en `packages/shared/tests/ai-actions.test.ts` (FR-009, Constitución I y II, research §12): una acción `create_expense` completa ("18000", `dining`, "Nequi") se convierte en el mismo `TransactionInput` que arma el formulario; `accountName` desconocido → usa la cuenta por defecto y agrega `accountId` a `inferred`; sin `occurredOn` → `today` y queda en `inferred`; sin `amount` → `{ status: 'incomplete', missing: ['amount'] }` sin inventar nada; `create_transfer` sin cuenta de destino → `incomplete`; `create_transfer` entre COP y USD conserva los dos montos; `categorySlug` de ingreso en un `create_expense` → rechazado por `transactionInputSchema`; un mensaje sin `version: 1` o con un tipo desconocido → rechazado por el esquema
- [ ] T063 Crear `packages/shared/src/ai-actions/transactions.ts`: tipos y esquema Zod del mensaje (`version: 1`, lista de acciones `create_expense` | `create_income` | `create_transfer` con datos opcionales e `inferred`) y `actionToTransactionInput(action, { accounts, defaultAccountId, today })` según research §12; exportar desde `packages/shared/src/index.ts`. Sin Gemini ni microservicio de IA (feature 004)
- [ ] T064 [P] Actualizar `README.md` (qué incluye la 002 y enlace a `specs/002-accounts-transactions/quickstart.md`) y la nota de `accounts` en `specs/001-auth-onboarding/data-model.md` (apuntar a `specs/002-accounts-transactions/data-model.md`)
- [ ] T065 Ejecutar `bunx biome check .`, `bun test --cwd apps/api`, `bun test --cwd packages/shared`, `bun run --cwd apps/mobile test` y `bun run --cwd apps/mobile test:sqlite`; todo en verde
- [ ] T066 Hacer el recorrido manual de `specs/002-accounts-transactions/quickstart.md` (pasos 1–15, revisión de logs y cronómetro del paso 1 para SC-001: menos de 5 s) en el celular por cable USB y registrar el resultado en `specs/002-accounts-transactions/checklists/quickstart-run.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup y **bloquea todas las historias**
- **Historias (Phases 3–8)**: dependen de Foundational
- **Polish (Phase 9)**: depende de las historias terminadas

### User Story Dependencies

- **US1 (P1)**: solo de Foundational (usa "Efectivo", que ya existe)
- **US2 (P1)**: usa `balances()` y el historial de T020; para probarla de punta a punta necesita movimientos (US1)
- **US3 (P1)**: solo de Foundational; el filtro por cuenta de US2 y el chip de cuenta de US1 se prueban mejor con varias cuentas
- **US4 (P2)**: depende de US1 (edita lo que US1 crea y reutiliza su formulario)
- **US5 (P2)**: depende de US3 (hacen falta dos cuentas) y extiende `save-transaction` de US1
- **US6 (P3)**: depende de US2 (necesita el saldo calculado) y extiende `save-transaction` de US1

### Within Each User Story

- Las pruebas se escriben primero y deben fallar
- Caso de uso → ruta → servicio de la app → pantallas
- Commit (conventional commits) por tarea o grupo lógico en `feat/002-accounts-transactions`

### Parallel Opportunities

- Foundational: compartido (T003–T008 y T010) en paralelo, después T009 y T011; el esquema del backend (T012–T015) en paralelo con la base local y la cola (T016–T021)
- En cada historia, todas las pruebas [P] en paralelo y las pantallas [P] en paralelo con el backend
- US3 puede avanzar en paralelo con US1 y US2; US4 en paralelo con US5 una vez terminadas US1 y US3

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo:
Task: "Pruebas unitarias de save-transaction en apps/api/tests/unit/save-transaction.test.ts"
Task: "Pruebas de contrato en apps/api/tests/contract/transactions-us1.test.ts"
Task: "Pruebas de integración en apps/api/tests/integration/us1-transactions.test.ts"
Task: "Pruebas de la app en apps/mobile/tests/us1-record.test.tsx"

# Pantalla en paralelo con el caso de uso:
Task: "Pantalla apps/mobile/src/app/(app)/transactions/new.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 (Setup) y Phase 2 (Foundational)
2. Phase 3 (US1): anotar gastos e ingresos
3. Phase 4 (US2): ver saldos e historial
4. **Validar**: pasos 1–4 del quickstart en el celular

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 + US2 → MVP (anotar y ver)
3. US3 → varias cuentas
4. US4 → corregir y borrar
5. US5 → transferencias
6. US6 → ajustes
7. Polish → integrar en `develop` cuando el usuario lo pida (el repo no tiene remoto)

---

## Notes

- [P] = archivos distintos y sin dependencias pendientes
- En los textos de la app se dice "cuenta de dinero" (Efectivo, Nequi…) para no confundirla con
  la cuenta del usuario
- Toda decisión técnica ya está tomada en `plan.md` y `research.md`; si una tarea contradice la
  spec, se corrige primero la spec (Constitución, flujo de desarrollo)
- Fuera de esta feature: descargar cambios de otros dispositivos (006), resumen del mes (007),
  tasas de cambio y totales consolidados (008), IA (004/005)
