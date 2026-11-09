# Research: Cuentas y movimientos manuales

Fase 0 de la feature 002. No se agrega ninguna herramienta ni servicio nuevo: todo se construye
con el stack de la 001 (ver `specs/001-auth-onboarding/research.md`). Aquí solo se documentan las
decisiones de diseño nuevas.

## 1. Un movimiento = una fila, también la transferencia

- **Decision**: una sola tabla `transactions` con `type` = `expense` | `income` | `transfer` |
  `adjustment`. La transferencia es **una fila** con cuenta de origen (`account_id`, `amount`) y
  cuenta de destino (`to_account_id`, `to_amount`).
- **Rationale**: FR-030 exige que las dos mitades cambien juntas o ninguna, también sin conexión y
  al enviarse por el outbox. Con una sola fila, cada envío (`PUT` idempotente) es atómico por
  construcción y no hace falta coordinar dos cambios de la cola. El saldo de una cuenta suma las
  filas donde es origen y resta/suma donde es destino.
- **Alternatives considered**: dos filas enlazadas por `transfer_group_id` (como un asiento
  contable). Más fiel a la contabilidad, pero obliga a enviar dos cambios que pueden quedar a
  medias si uno se rechaza; descartado para el MVP.

## 2. Categorías: catálogo compartido, columna `category_slug`

- **Decision**: las 26 categorías viven en `packages/shared/src/catalog/categories.ts` (slug,
  nombre visible, tipo). La tabla `transactions` guarda `category_slug` (texto); el servidor y la
  app validan contra el catálogo. No se crea tabla `categories` en esta feature.
- **Rationale**: la lista es fija y la definen el producto y el código (Constitución V); una tabla
  copiaría el catálogo sin aportar nada hasta que existan las frases de ejemplo del encoder. El
  slug es estable, así que la tabla de la feature 005 puede usar `slug` como clave primaria y
  agregar la llave foránea sin migrar datos.
- **Alternatives considered**: tabla `categories` con UUID (como sugiere `docs/arquitectura.md`).
  Obliga a sembrarla y a mantener los UUID sincronizados entre servidor, app y pruebas; se
  pospone a la 005.

## 3. Envío al servidor: `PUT` idempotente por entidad con last-write-wins

- **Decision**: `PUT /v1/accounts/{id}` y `PUT /v1/transactions/{id}` reciben el **registro
  completo** con el `updatedAt` del teléfono (crea o reemplaza). `DELETE /v1/transactions/{id}`
  marca `deleted_at` (borrado lógico, Constitución III) y lleva también `updatedAt`. Se aplica
  solo si `updatedAt` es más nuevo que el del servidor; si no, `409` con la versión del servidor,
  igual que el perfil (research §6 de la 001). Repetir el mismo envío da `200` sin duplicar
  (FR-036).
- **Rationale**: reutiliza el outbox y el `http-sender` existentes sin cambios de diseño. En la
  002 solo escribe un dispositivo por usuario, así que LWW por registro basta; la resolución de
  conflictos entre dispositivos se diseña en la 006.
- **Deshacer un borrado** (FR-026): el borrado se aplica en el teléfono y se encola de inmediato.
  "Deshacer" encola un `PUT` del registro con `deletedAt = null` y un `updatedAt` más nuevo. Si el
  `DELETE` ya llegó, el `PUT` lo revive; si no, ambos llegan en orden y el resultado final es el
  mismo.
- **Compactar la cola**: al encolar un cambio de una entidad que ya tiene cambios pendientes sin
  enviar, se quitan los anteriores (el `PUT` es el registro completo). Cumple el caso límite
  "llega en su estado final, sin pasos intermedios" y reduce envíos.
- **Alternatives considered**: un endpoint de lote `POST /v1/sync` con todos los cambios. Es lo
  que probablemente pida la 006 (junto con la descarga), pero hoy agrega un formato nuevo sin
  necesidad.

## 4. Rechazos del servidor: el registro se queda y se marca (FR-037)

- **Decision**: cada cuenta y cada movimiento locales tienen `sync_state` (`pending` | `synced` |
  `rejected`) y `sync_error`. El `http-sender` recibe un nuevo `onRejected(item, body)` para los
  `4xx` sin arreglo (hoy solo los descarta): el servicio de la entidad marca el registro como
  `rejected` con el mensaje del servidor, y la cola sigue con los demás. Al corregirlo, el nuevo
  `PUT` lo vuelve a `pending`. Un `2xx` lo marca `synced`.
- **Rationale**: aclaración del 2026-10-28: no se pierde nada de lo que el usuario anotó, y un
  rechazo no bloquea la cola.
- **Orden y dependencias**: la cuenta siempre se encola antes que sus movimientos (se crea antes),
  y el outbox envía en orden. Si una cuenta es rechazada, sus movimientos llegarán con una cuenta
  desconocida y también se marcarán `rejected` con un mensaje que apunta a la cuenta.

## 5. Dinero exacto en el teléfono: enteros en diezmilésimas

- **Decision**: el contrato y PostgreSQL usan decimal exacto (`numeric(19,4)` y texto). En SQLite,
  que no tiene tipo decimal, cada monto se guarda **dos veces**: como texto (`amount`, el valor
  canónico) y como entero en diezmilésimas (`amount_e4 = monto × 10.000`), que es lo que suman las
  consultas de saldo. Las conversiones texto ↔ entero viven en `packages/shared/src/money/` y usan
  `BigInt`, sin punto flotante.
- **Rationale**: Constitución IV prohíbe el punto flotante; `SUM()` sobre texto en SQLite convierte
  a `REAL`. Con enteros la suma es exacta. Con el tope de 12 dígitos enteros (FR-005) un monto
  máximo ocupa 10^16 diezmilésimas, y el entero de 64 bits de SQLite llega a 9,2 × 10^18: alcanza
  para cientos de movimientos de monto máximo en una misma cuenta y para cualquier uso realista.
  Si una suma se desborda, SQLite lanza error en vez de devolver un valor erróneo.
- **Alternatives considered**: una librería de decimales en JS (big.js, decimal.js): suma una
  dependencia y obliga a cargar todos los movimientos en memoria para sumar (choca con SC-004).
  Guardar en unidades menores de la moneda: no sirve si una moneda cambia de decimales.

## 6. Decimales por moneda: COP sin centavos

- **Decision**: el catálogo `packages/shared/src/catalog/currencies.ts` pasa COP a
  `decimals: 0`. El resto queda como está (CLP y PYG ya en 0). La validación de monto usa
  `decimals` de la moneda de la cuenta (FR-005, escenario 1.6).
- **Rationale**: en Colombia nadie usa centavos; ISO 4217 lista 2 decimales para COP solo por
  historia. La spec lo pide así. El campo `decimals` del catálogo ya se define como "decimales con
  los que se muestra y se guarda el monto", así que es el lugar correcto. Hoy no hay montos de COP
  guardados con decimales (solo "Efectivo" con saldo inicial 0), así que no hay datos que migrar.
  La prueba del catálogo en `packages/shared/tests/validation.test.ts` se actualiza.
- **Entrada al estilo colombiano**: el teclado numérico admite `.` como separador de miles y `,`
  como decimal ("18.000", "12,50"); la función `parseAmount` de `shared/money` normaliza a
  `"18000"` / `"12.50"`.

## 7. Saldos calculados, nunca guardados

- **Decision**: el saldo de una cuenta = `initial_balance` + Σ(ingresos) − Σ(gastos) ±
  Σ(ajustes con signo) − Σ(`amount` de transferencias que salen) + Σ(`to_amount` de las que
  entran), sobre filas con `deleted_at IS NULL`. En el teléfono es una consulta agregada sobre
  `amount_e4` / `to_amount_e4`; en el servidor, la misma suma sobre `numeric`.
- **Rationale**: un saldo guardado se descuadra con cada edición, borrado o rechazo; calcularlo
  garantiza SC-003. Con índices por cuenta, 5.000 filas se suman en milisegundos (SC-004).
- **Signo de los montos**: `amount` es siempre positivo para gasto, ingreso y transferencia; el
  tipo da el signo. Solo el ajuste lleva signo (`+` o `−`), porque es una diferencia.

## 8. Fecha del movimiento: día local, sin hora

- **Decision**: `occurred_on` es una fecha (`date` en PostgreSQL, `YYYY-MM-DD` en SQLite y en el
  contrato), calculada con la hora del teléfono (FR-007). El orden dentro de un mismo día lo da
  `created_at`. El servidor rechaza fechas más de 1 día posteriores a su propio "hoy" en UTC, para
  tolerar las zonas horarias sin aceptar fechas futuras reales.
- **Rationale**: el usuario piensa en días ("el gasto de ayer"), no en instantes; una fecha sin
  zona horaria evita que un gasto de las 11 p. m. aparezca al día siguiente.

## 9. Cuenta por defecto y nombres únicos

- **Decision**:
  - Marcar una cuenta como cuenta por defecto (`isDefault = true`) desmarca las demás **en el
    servidor**, dentro de la misma transacción del `PUT`. Así no importa el orden en que lleguen
    los cambios de las dos cuentas y el índice único parcial existente nunca falla. El teléfono
    hace lo mismo en su base local.
  - Nombre único entre cuentas activas sin distinguir mayúsculas: índice único parcial sobre
    `(user_id, lower(name))` con `archived_at IS NULL AND deleted_at IS NULL`.
  - Máximo 20 cuentas activas (FR-023), validado en el caso de uso.
  - La moneda solo cambia si la cuenta no tiene movimientos vivos (como origen ni como destino,
    FR-019).
  - No se puede archivar la cuenta por defecto (FR-020, FR-021).
- **Una sola fuente** (Constitución I): estas reglas son funciones puras en
  `packages/shared/src/rules/accounts.ts`. Reciben la cuenta tal como quedaría, las demás cuentas
  del usuario y si la cuenta tiene movimientos, y devuelven los errores por campo. El caso de uso
  `save-account` del servidor y el servicio de cuentas del teléfono llaman a las mismas
  funciones; ninguno las reescribe.
- **Rationale**: el teléfono necesita responder al instante sin conexión (Constitución III) y el
  servidor es el que manda; con una sola implementación compartida no pueden comportarse
  distinto. El servidor además las vuelve a comprobar con sus datos, que son los que valen.

## 10. Un caso de uso por tipo de movimiento (Constitución I)

- **Decision**: `apps/api/src/application/use-cases/save-transaction.ts` concentra la validación y
  el guardado de los cuatro tipos (`expense`, `income`, `transfer`, `adjustment`). La ruta HTTP solo
  traduce. La feature 004 (IA) llamará a este mismo caso de uso al confirmar una acción propuesta.
  Las reglas puras (monto, categoría según tipo, fecha) están en `packages/shared/src/validation/
  transaction.ts` para que la app las aplique sin conexión con el mismo código.

## 11. Pantallas y número de toques (FR-002, SC-001)

- **Decision**: un botón "+" fijo en Inicio abre "Registrar movimiento" con el foco en el monto y
  el teclado numérico ya abierto; debajo, la cuadrícula de categorías del tipo elegido. Flujo
  típico: toque en "+" (1), escribir monto, toque en la categoría (2), toque en "Guardar" (3).
  Cuenta y fecha se ven como chips editables, ya llenos.
- **Deshacer**: un aviso inferior ("Movimiento borrado · Deshacer") visible 5 s (FR-026).
- **Listas largas**: el historial usa una lista virtualizada por secciones (día) con paginación
  local de 50 en 50 (SC-004).

## 12. Formato de las acciones que propondrá la IA (Constitución I y II)

- **Decision**: `packages/shared/src/ai-actions/transactions.ts` define desde ya, sin ninguna IA
  conectada:
  - Tres tipos de acción con los nombres de la Constitución II: `create_expense`,
    `create_income` y `create_transfer`. El ajuste de saldo no tiene acción de IA: es una
    corrección del usuario, no algo que se cuente en un relato.
  - Datos de cada acción: `amount` (texto decimal), `categorySlug`, `accountName` (y
    `toAccountName`, `toAmount` en transferencias), `occurredOn` y `description`, todos
    opcionales salvo el tipo, porque la IA puede no encontrarlos en el relato. La IA da el
    **nombre** de la cuenta, nunca su id interno.
  - `inferred`: la lista de campos que la IA adivinó (Constitución II: todo dato inferido se
    muestra marcado).
  - `version: 1` en el mensaje completo (Constitución VII: el contrato con la IA está versionado
    y se valida en los dos lados), validado con un esquema Zod.
  - `actionToTransactionInput(action, { accounts, defaultAccountId, today })`: convierte la
    acción en el mismo `TransactionInput` que arma el formulario manual. Busca la cuenta por
    nombre entre las activas sin distinguir mayúsculas; si no la encuentra usa la cuenta por
    defecto y agrega `accountId` a los inferidos; si falta la fecha pone `today` y la marca como
    inferida. Si falta algo que no se puede suponer (el monto o, en una transferencia, la cuenta
    de destino), no inventa nada: devuelve `{ status: 'incomplete', missing: [...] }` para que la
    pantalla de confirmación lo pregunte. El resultado completo se valida con
    `transactionInputSchema`, así que una categoría de ingreso en un gasto se rechaza igual que
    en el formulario.
- **Rationale**: la Constitución I pide que un módulo nuevo defina a la vez su formulario y su
  tipo de acción para la IA. Con el formato y la conversión listos, la feature 004 solo tiene que
  producir estas acciones y mostrarlas: la IA y el formulario llegan al mismo caso de uso
  (`save-transaction`) sin código paralelo.
- **Fuera de esta feature** (004): Gemini, el microservicio FastAPI, las instrucciones para el
  modelo, la pantalla de confirmación y el modo automático.
