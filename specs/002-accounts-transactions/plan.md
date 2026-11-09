# Implementation Plan: Cuentas y movimientos manuales

**Branch**: `feat/002-accounts-transactions` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-accounts-transactions/spec.md`

## Summary

Segunda feature de Saveria: el usuario registra dinero de verdad, sin IA y sin conexión.

- Gestión completa de cuentas (efectivo, billetera digital, banco) con moneda, saldo inicial,
  cuenta por defecto y archivado.
- Gastos e ingresos con el catálogo fijo de 26 categorías; transferencias entre cuentas (también
  entre monedas, sin tasa) y ajustes de saldo.
- Historial agrupado por día y saldos calculados, cada uno en la moneda de su cuenta.
- Todo se escribe primero en la base cifrada del teléfono y se envía con el outbox de la 001,
  mediante `PUT` idempotentes con last-write-wins. Un rechazo del servidor deja el registro
  marcado en el teléfono, sin perderlo.

No se agregan herramientas ni servicios. Las decisiones están en [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript en todo el proyecto (5.x en api y shared, 6.0 en la app). Bun
1.4 (backend). Expo SDK 58 / React Native 0.88 (app).

**Primary Dependencies**: las mismas de la 001 (Hono 4.13, Zod 4.6, Drizzle 0.45 + drizzle-kit
0.31, postgres.js 3.4, openapi-fetch 0.17, Zustand 5, react-hook-form 7.90, NetInfo 12). Ninguna
nueva: el dinero exacto en el teléfono usa `BigInt` nativo (research §5).

**Storage**: PostgreSQL 17 (tablas `accounts` ampliada y `transactions` nueva). En el teléfono,
el SQLite cifrado por usuario de la 001 (tablas `accounts` ampliada y `transactions` nueva).

**Testing**: `bun test` (unitarias, contrato con `ajv`, integración contra Postgres real) y
`jest-expo` + React Native Testing Library en la app, igual que en la 001.

**Target Platform**: Android (development build propia). Backend en Linux con Docker.

**Project Type**: app móvil + API (monorepo).

**Performance Goals**:

- Registrar un gasto típico en menos de 5 s y con máximo 3 toques más el monto (SC-001).
- Historial y saldos en menos de 1 s con 5.000 movimientos, sin conexión (SC-004).
- `PUT` de un movimiento p95 < 100 ms en el servidor.

**Constraints**: offline primero (todo funciona sin red); montos exactos sin punto flotante;
logs sin montos ni descripciones (FR-040); body de máximo 16 KB; un solo desarrollador.

**Scale/Scope**:

- Hasta 20 cuentas activas y miles de movimientos por usuario.
- 3 endpoints nuevos (`PUT /v1/accounts/{id}`, `PUT` y `DELETE /v1/transactions/{id}`).
- Unas 7 pantallas nuevas o rehechas: Inicio (saldos + últimos movimientos), Registrar
  movimiento, Editar movimiento, Transferir, Cuentas (lista y archivadas), Crear/editar cuenta,
  Ajustar saldo.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo se cumple | Estado |
|---|---|---|
| I. Dos puertas, un caso de uso | `save-transaction` concentra los cuatro tipos y la 004 lo reutilizará. Ninguna regla se escribe dos veces: las de movimientos están en `packages/shared/src/validation/transaction.ts` y las de cuentas en `packages/shared/src/rules/accounts.ts`; el servidor y el teléfono llaman a las mismas funciones (research §9, §10) | ✅ |
| II. La IA propone | No hay IA en esta feature. Cuenta y fecha por defecto los elige el formulario a la vista del usuario, no se infieren | N/A |
| III. Offline primero | UUID del cliente en cuentas y movimientos; `created_at`/`updated_at`/`deleted_at` en ambas tablas; borrado lógico; outbox. La estrategia de conflicto entre dispositivos se define en la 006; aquí solo LWW de un dispositivo (research §3) | ✅ |
| IV. Precisión monetaria y multimoneda | `numeric(19,4)` + `char(3)`; texto en el contrato; enteros exactos en SQLite (research §5); el movimiento usa la moneda de su cuenta; transferencias y ajustes sin categoría. **Totales consolidados**: la regla exige convertir con tasas, que llegan en la 008. Para no violarla, la 002 no muestra totales que mezclen monedas y solo suma cuando todas las cuentas activas están en la moneda principal (FR-012, FR-013) | ✅ |
| V. Categorización en capas | Lista fija sin categorías personalizadas (catálogo compartido). La categorización automática llega en la 005 | ✅ |
| VI. Privacidad | Borrado en cascada de cuentas y movimientos; aislamiento por usuario (404 sin revelar ids ajenos); logs sin montos ni descripciones, con prueba automática | ✅ |
| VII. Clean Architecture y contratos | Casos de uso `save-account`, `save-transaction`, `delete-transaction` con puertos de repositorio; contrato acumulativo `contracts/openapi.yaml` (0.2.0) escrito antes del código | ✅ |
| VIII. Pruebas guiadas por la spec | Cada escenario tiene una prueba o un diferimiento explícito (matriz abajo) | ✅ |
| Stack | Sin herramientas nuevas | ✅ |

**Post-diseño (Fase 1)**: re-evaluado tras escribir el modelo de datos y el contrato. Sin
violaciones.

## Matriz de escenarios → pruebas

U = unitaria (api o shared), C = contrato, I = integración backend, M = app (jest), Q = recorrido
manual del quickstart.

| Escenario | Prueba | Diferido |
|---|---|---|
| 1.1–1.3 | M (valores por defecto del formulario, categorías por tipo, 3 toques) · U (catálogo: 18 + 8 slugs únicos) | — |
| 1.4 | M (guardado local + outbox sin red, envío al volver) · I (el `PUT` crea el movimiento) | — |
| 1.5–1.6 | U (shared: monto > 0, 12 dígitos, decimales por moneda, `parseAmount` colombiano) · I + C (400 con `fields`) · M (mensajes en el formulario) | — |
| 1.7 | I (el mismo `PUT` dos veces = una fila) · U (LWW: igual o más viejo → 409) | — |
| 2.1 | U (shared y api: fórmula del saldo) · M (saldo local con `amount_e4`) · I (saldo en el servidor) | — |
| 2.2–2.3 | M (agrupado por día, orden, filtro por cuenta incluye transferencias) | — |
| 2.4–2.5 | M (sin total con monedas mezcladas; total cuando todas están en la principal; archivadas no suman) | Total consolidado con tasas → 008 |
| 2.6 | M (historial y saldos con la red apagada) | — |
| 3.1–3.4 | M (crear, moneda preseleccionada, cambiar la predeterminada, renombrar) · I (`isDefault` desmarca las demás en la misma transacción) | — |
| 3.5 | U + I (nombre único sin distinguir mayúsculas entre activas) | — |
| 3.6–3.7 | I (archivar con saldo; no archivar la predeterminada) · M (aviso de saldo, "cuentas archivadas") | — |
| 3.8 | U + I (moneda inmutable con movimientos, también como destino de transferencia) | — |
| 3.9 | M (crear cuenta sin red → outbox) | — |
| 4.1–4.3 | M (editar recalcula saldos; cambiar a otra moneda pide el monto) · I (moneda distinta a la de la cuenta → 400) | — |
| 4.4–4.6 | M ("Deshacer" ≥ 5 s restaura; sin red) · I (`DELETE` lógico; `PUT` con `deletedAt: null` revive) · C (204) | — |
| 5.1–5.5 | U (validación de transferencia) · I (una fila, saldos de origen y destino, misma cuenta → 400, borrar mueve los dos saldos) · M (dos montos si las monedas difieren) | — |
| 6.1–6.4 | U (diferencia con signo; igual → no crea) · M (ajuste distinguido en el historial) · I (ajuste sin categoría) | — |
| Casos límite | U (fechas futuras, monto máximo, descripción de 120) · M (compactar la cola: crear + editar + borrar sin red = estado final) · I (cuentas de otro usuario → 404, sin moneda principal → 422) | Descargar cambios de otro teléfono → 006 |
| FR-037 | M (`onRejected` marca `rejected` con el motivo y la cola sigue) · Q (paso 14) | — |
| FR-040 / SC-006 | I (la prueba de logs de la 001 cubre los endpoints nuevos: sin montos ni descripciones) | — |
| FR-041 | I (borrar el usuario borra cuentas y movimientos) | — |
| SC-004 | M (consulta de saldos e historial con 5.000 filas sembradas) · Q (paso 15) | — |

## Project Structure

### Documentation (this feature)

```text
specs/002-accounts-transactions/
├── plan.md              # Este archivo
├── research.md          # Decisiones (Fase 0)
├── data-model.md        # Entidades y reglas (Fase 1)
├── quickstart.md        # Guía de validación (Fase 1)
├── contracts/
│   └── openapi.yaml     # Contrato acumulativo 0.2.0 (001 + 002)
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/shared/src/
├── catalog/categories.ts         # nuevo: 26 categorías (slug, nombre, tipo)
├── catalog/currencies.ts         # COP → decimals 0
├── money/                        # nuevo: parseAmount, toE4/fromE4 (BigInt), formatAmount
├── validation/account.ts, transaction.ts   # nuevas reglas Zod
└── rules/accounts.ts             # nuevo: reglas entre cuentas (una sola fuente, Constitución I)

apps/api/
├── drizzle/                      # migración nueva (enums, accounts, transactions, índices)
├── src/domain/entities.ts        # Account ampliada, Transaction
├── src/application/
│   ├── ports/repositories.ts     # AccountRepository ampliado, TransactionRepository
│   └── use-cases/                # save-account, save-transaction, delete-transaction
├── src/infrastructure/db/        # schema.ts, repositories/transaction-repository.ts
├── src/interfaces/http/routes/   # accounts.ts, transactions.ts (nuevas)
├── src/app.ts                    # sirve el contrato de la 002 en /docs
└── tests/support/contract.ts     # valida contra el contrato de la 002

apps/mobile/
├── package.json                  # api:types apunta al contrato de la 002
├── src/db/schema.ts + migrations # accounts ampliada, transactions
├── src/outbox/                   # http-sender: onRejected; outbox: compactar por entidad
├── src/features/accounts/        # servicio y repositorio local de cuentas
├── src/features/transactions/    # servicio, saldos, historial
└── src/app/(app)/                # home (rehecha), transactions/new, transactions/[id],
                                  # transfer, accounts/ (index, archived, new, [id], [id]/adjust)
```

**Structure Decision**: la misma de la 001. Se agrega una carpeta por funcionalidad en la app
(`features/accounts`, `features/transactions`) y una ruta por recurso en el backend.

## Decisiones clave (resumen de research.md)

1. **Transferencia = una fila** con origen y destino; atómica por construcción (FR-030).
2. **Categorías por slug** del catálogo compartido; la tabla llega en la 005.
3. **`PUT` idempotente + LWW** por entidad, con `DELETE` lógico; "Deshacer" es un `PUT` con
   `deletedAt: null`. La cola se compacta por entidad.
4. **Rechazos**: `sync_state` / `sync_error` en el teléfono y `onRejected` en el `http-sender`.
5. **Dinero exacto en SQLite**: texto canónico + entero en diezmilésimas para sumar.
6. **COP sin decimales** en el catálogo.
7. **Saldos calculados**, nunca guardados.
8. **Fecha local** (`occurred_on`), sin hora; el servidor tolera 1 día por zonas horarias.
9. **Cuenta por defecto**: marcar una desmarca las demás en el servidor, en la misma transacción.

## Riesgos y validaciones tempranas

- **Cambio de contrato de referencia**: el backend, sus pruebas y la app pasan a usar el contrato
  de la 002. Es la primera tarea, para que las pruebas de contrato de la 001 sigan pasando contra
  el archivo nuevo antes de agregar nada.
- **Migración local en teléfonos con datos**: la 001 ya está instalada en el emulador y en el
  celular; la migración de SQLite debe agregar columnas con valores por defecto (`type = 'cash'`,
  `sync_state = 'synced'`) sin perder la cuenta "Efectivo" ni la sesión.
- **Rendimiento con 5.000 filas**: medir temprano la consulta de saldos y la primera página del
  historial en el celular real.
- **Teclado y formato colombiano**: validar en el celular que `.` de miles y `,` decimal se
  interpretan bien con el teclado numérico de Android.

## Complexity Tracking

| Elemento | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Monto doble en SQLite (texto + entero en diezmilésimas) | Sumar sin punto flotante (Constitución IV) y sin cargar todo en memoria (SC-004) | Sumar texto en SQLite: convierte a `REAL` |
| `sync_state` en cada registro local | FR-037: conservar y marcar lo rechazado | Descartar el cambio: pierde datos del usuario |
| Contrato acumulativo (copia del de la 001) | La app y las pruebas necesitan un solo archivo completo | `$ref` entre archivos de specs: complica `openapi-typescript` y `ajv` |
