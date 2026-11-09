# Feature Specification: Cuentas y movimientos manuales

**Feature Branch**: `feat/002-accounts-transactions`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Cuentas y movimientos manuales: que el usuario pueda registrar dinero de verdad sin IA y sin conexión. Registrar gastos e ingresos con la lista fija de categorías, ver el historial y el saldo de cada cuenta, crear y administrar cuentas (efectivo, billetera digital, banco) con su moneda y saldo inicial, editar y borrar movimientos, transferir entre cuentas y ajustar el saldo cuando no cuadra."

## Clarifications

### Session 2026-10-28

- Q: ¿Se puede archivar una cuenta que todavía tiene saldo, y ese saldo sigue sumando en el total? → A: Sí, con cualquier saldo y avisando cuánto tiene; su saldo deja de sumar en el total y sale de la lista principal, pero se ve en "cuentas archivadas" y su historial se conserva.
- Q: Cuando el servidor rechaza un movimiento o una cuenta que ya se guardó en el teléfono, ¿qué pasa con él? → A: Se queda en el teléfono y en el saldo, marcado como "no se pudo guardar" con el motivo; el usuario lo corrige o lo borra y el envío se reintenta.
- Q: Al borrar un movimiento, ¿cómo evitamos borrados por error? → A: Se borra al instante, sin pedir confirmación, y durante unos segundos aparece la opción "Deshacer".
- Q: Si un gasto deja una cuenta en negativo, ¿qué hace la app? → A: Lo guarda sin aviso ni confirmación y muestra el saldo negativo destacado (en rojo).
- Q: ¿Se puede registrar un movimiento con una fecha futura? → A: No; solo hoy o fechas pasadas, sin límite hacia atrás. Lo que aún no pasó llega con los movimientos recurrentes (v2).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar un gasto o un ingreso (Priority: P1)

El usuario anota un gasto o un ingreso en pocos segundos: escribe el monto, elige la categoría y
guarda. La cuenta viene preseleccionada con su cuenta por defecto y la fecha con el día de hoy;
puede cambiarlas y agregar una descripción corta si quiere. Funciona igual con o sin internet.

**Why this priority**: registrar sin fricción es el problema central del producto. Sin esto
Saveria no sirve para nada todavía.

**Independent Test**: con una cuenta recién creada (solo "Efectivo"), se registra un gasto y un
ingreso, con y sin conexión, y ambos quedan guardados con su monto, categoría, cuenta y fecha.

**Acceptance Scenarios**:

1. **Given** un usuario con el onboarding terminado, **When** abre "registrar movimiento",
   **Then** ve el tipo "gasto" seleccionado, su cuenta por defecto elegida y la fecha de hoy.
2. **Given** el formulario de gasto abierto, **When** escribe un monto, toca una categoría y
   guarda, **Then** el gasto queda registrado en la cuenta por defecto con la fecha de hoy, en
   máximo 3 toques además de escribir el monto.
3. **Given** el formulario abierto, **When** cambia a "ingreso", **Then** solo se muestran las 8
   categorías de ingreso; en "gasto" solo se muestran las 18 de gasto.
4. **Given** un usuario sin conexión, **When** registra un gasto, **Then** el gasto se guarda en
   el teléfono, aparece de inmediato en el historial y se envía al servidor cuando vuelve la
   conexión, sin que el usuario haga nada.
5. **Given** el formulario abierto, **When** intenta guardar sin monto, con monto cero o negativo,
   o sin categoría, **Then** no se guarda y se indica qué falta.
6. **Given** una cuenta en COP, **When** el usuario escribe un monto, **Then** el movimiento usa
   la moneda de esa cuenta y acepta solo los decimales que esa moneda permite (COP sin centavos,
   USD con 2).
7. **Given** un movimiento que ya se envió al servidor, **When** el envío se repite por un
   reintento de red, **Then** el servidor no lo duplica.

---

### User Story 2 - Ver el historial y el saldo (Priority: P1)

El usuario abre Saveria y ve cuánto tiene en cada cuenta y sus últimos movimientos, ordenados del
más reciente al más antiguo. Puede filtrar el historial por cuenta.

**Why this priority**: anotar sin poder ver el resultado no genera el hábito; el saldo es la
recompensa inmediata del registro.

**Independent Test**: tras registrar varios movimientos en dos cuentas, el saldo de cada una es
igual al saldo inicial más los ingresos menos los gastos, y el historial los muestra en orden.

**Acceptance Scenarios**:

1. **Given** una cuenta con saldo inicial 100.000 COP, un ingreso de 50.000 y un gasto de 30.000,
   **When** el usuario mira sus cuentas, **Then** el saldo de esa cuenta es 120.000 COP.
2. **Given** varios movimientos de fechas distintas, **When** abre el historial, **Then** los ve
   agrupados por día, del más reciente al más antiguo, cada uno con monto, moneda, categoría,
   cuenta y descripción.
3. **Given** dos cuentas, **When** filtra el historial por una, **Then** solo ve los movimientos
   de esa cuenta, incluidas las transferencias que entran o salen de ella.
4. **Given** cuentas en COP y en USD, **When** mira sus cuentas, **Then** cada saldo aparece en
   la moneda de su cuenta y no se muestra un total que mezcle monedas.
5. **Given** que todas las cuentas activas están en la moneda principal, **When** mira sus
   cuentas, **Then** ve además el total de todas ellas.
6. **Given** un usuario sin conexión, **When** abre el historial, **Then** ve todos sus
   movimientos guardados en el teléfono y los saldos calculados con ellos.

---

### User Story 3 - Gestionar cuentas (Priority: P1)

El usuario crea las cuentas donde tiene su dinero: efectivo, billeteras digitales como Nequi o
Daviplata y cuentas de banco. Cada una tiene nombre, tipo, moneda y saldo inicial. Puede
renombrarlas, elegir cuál es la cuenta por defecto y archivar las que ya no usa.

**Why this priority**: separar el dinero por cuentas es parte del MVP y la base de las
transferencias; sin poder crear cuentas, todo queda en "Efectivo".

**Independent Test**: se crea una cuenta "Nequi" en COP con saldo inicial, se marca como cuenta
por defecto y el siguiente gasto la trae preseleccionada.

**Acceptance Scenarios**:

1. **Given** un usuario con solo "Efectivo", **When** crea la cuenta "Nequi", tipo billetera
   digital, en COP y con saldo inicial 80.000, **Then** la cuenta aparece en su lista con saldo
   80.000 COP.
2. **Given** el formulario de cuenta nueva, **When** el usuario lo abre, **Then** la moneda viene
   preseleccionada con su moneda principal y la puede cambiar.
3. **Given** dos cuentas, **When** marca "Nequi" como cuenta por defecto, **Then** "Efectivo" deja
   de serlo y el formulario de registro trae "Nequi" preseleccionada.
4. **Given** una cuenta existente, **When** la renombra, **Then** el nuevo nombre aparece en la
   lista y en todos sus movimientos.
5. **Given** una cuenta activa con otro nombre igual, **When** intenta crear o renombrar otra con
   ese mismo nombre (sin importar mayúsculas), **Then** no se permite y se indica por qué.
6. **Given** una cuenta que no es la cuenta por defecto y con saldo 20.000, **When** la archiva,
   **Then** se le avisa del saldo que tiene; al confirmar, la cuenta sale de la lista principal,
   del total y de la elección de cuenta para movimientos nuevos, pero aparece en "cuentas
   archivadas" y sus movimientos siguen en el historial.
7. **Given** la cuenta por defecto, **When** intenta archivarla, **Then** se le pide elegir antes
   otra cuenta por defecto.
8. **Given** una cuenta con movimientos, **When** intenta cambiar su moneda, **Then** no se
   permite; la moneda solo se puede cambiar mientras la cuenta no tiene movimientos.
9. **Given** un usuario sin conexión, **When** crea una cuenta, **Then** queda guardada y usable
   en el teléfono y se envía al servidor cuando vuelve la conexión.

---

### User Story 4 - Editar y borrar un movimiento (Priority: P2)

El usuario se equivocó en un monto, una categoría, una cuenta o una fecha y lo corrige; o anotó
algo dos veces y lo borra.

**Why this priority**: los errores al registrar rápido son normales; sin corregirlos, los saldos
pierden confianza. Puede esperar a tener el registro y el historial.

**Independent Test**: se edita el monto de un gasto y se borra otro; los saldos se recalculan y
el movimiento borrado desaparece del historial, también sin conexión.

**Acceptance Scenarios**:

1. **Given** un gasto de 18.000, **When** el usuario cambia el monto a 20.000 y guarda, **Then**
   el historial muestra 20.000 y el saldo de la cuenta baja 2.000 más.
2. **Given** un gasto, **When** cambia su categoría, cuenta o fecha, **Then** el cambio se refleja
   en el historial y en los saldos de las cuentas afectadas.
3. **Given** un gasto, **When** lo cambia a otra cuenta con distinta moneda, **Then** se le pide
   confirmar el monto en la moneda de la nueva cuenta, porque no se convierte solo.
4. **Given** un movimiento, **When** lo borra, **Then** desaparece del historial al instante, el
   saldo vuelve a como estaba sin él y durante unos segundos aparece "Deshacer".
5. **Given** un movimiento recién borrado, **When** toca "Deshacer" a tiempo, **Then** el
   movimiento y el saldo vuelven a estar como antes.
6. **Given** un usuario sin conexión, **When** edita o borra un movimiento, **Then** el cambio se
   aplica en el teléfono de inmediato y se envía al servidor cuando vuelve la conexión.

---

### User Story 5 - Transferir entre cuentas (Priority: P2)

El usuario pasa dinero de una cuenta a otra, por ejemplo de Bancolombia a Nequi. La transferencia
mueve los saldos pero no cuenta como gasto ni como ingreso.

**Why this priority**: sin transferencias, las cuentas se descuadran apenas el usuario mueve
dinero entre ellas; depende de poder tener varias cuentas.

**Independent Test**: se transfieren 100.000 COP de "Bancolombia" a "Nequi"; el saldo de la
primera baja 100.000, el de la segunda sube 100.000 y ningún gasto ni ingreso cambia.

**Acceptance Scenarios**:

1. **Given** dos cuentas en COP, **When** transfiere 100.000 de una a otra, **Then** la de origen
   baja 100.000, la de destino sube 100.000 y la transferencia aparece una sola vez en el
   historial general.
2. **Given** una transferencia, **When** el usuario la registra, **Then** no se le pide categoría
   y no cuenta como gasto ni como ingreso.
3. **Given** una cuenta en USD y otra en COP, **When** transfiere de una a otra, **Then** se le
   piden el monto que sale (en USD) y el que entra (en COP), sin calcular ninguna tasa.
4. **Given** el formulario de transferencia, **When** elige la misma cuenta como origen y
   destino, **Then** no se permite.
5. **Given** una transferencia, **When** la edita o la borra, **Then** los dos saldos se
   recalculan juntos; nunca queda una mitad sin la otra.

---

### User Story 6 - Ajustar el saldo (Priority: P3)

El saldo que muestra Saveria no coincide con el real (olvidó anotar algo). El usuario escribe el
saldo real y Saveria registra un movimiento de ajuste por la diferencia, sin tocar los
movimientos anteriores.

**Why this priority**: evita que el usuario abandone una cuenta descuadrada, pero es poco
frecuente y no bloquea el uso diario.

**Independent Test**: una cuenta muestra 120.000 y el usuario dice que tiene 115.000; se crea un
ajuste de −5.000 y el saldo queda en 115.000 sin que cambie ningún otro movimiento.

**Acceptance Scenarios**:

1. **Given** una cuenta con saldo 120.000, **When** el usuario indica que el saldo real es
   115.000, **Then** se registra un ajuste de −5.000 y el saldo queda en 115.000.
2. **Given** un ajuste, **When** aparece en el historial, **Then** se distingue como ajuste, sin
   categoría, y no cuenta como gasto ni como ingreso.
3. **Given** una cuenta, **When** el usuario indica un saldo real igual al actual, **Then** no se
   crea ningún ajuste.
4. **Given** un ajuste, **When** el usuario lo borra, **Then** el saldo vuelve al valor anterior.

---

### Edge Cases

- El usuario sin moneda principal (onboarding sin terminar) no ve la opción de registrar
  movimientos ni de crear cuentas.
- Un gasto puede dejar el saldo de una cuenta en negativo (sobregiro, deuda con el banco); se
  guarda sin aviso y el saldo se muestra negativo y destacado.
- Montos muy grandes: se rechazan montos con más de 12 dígitos enteros.
- Montos con separadores de miles o coma decimal al estilo colombiano ("18.000", "12,50") se
  interpretan según la moneda de la cuenta.
- Fechas: no se permiten fechas futuras (los movimientos programados son de una feature
  posterior); sí cualquier fecha pasada.
- Un movimiento creado sin conexión y luego editado o borrado antes de enviarse llega al servidor
  en su estado final, sin pasos intermedios que lo dupliquen.
- El servidor rechaza un gasto ya guardado en el teléfono: el gasto sigue en el historial con la
  marca "no se pudo guardar" y el motivo hasta que el usuario lo corrija o lo borre.
- Una cuenta archivada con movimientos sin enviar: los movimientos se envían igual.
- El usuario cierra sesión con movimientos sin enviar: se conservan y se envían cuando ese mismo
  usuario vuelve a entrar (regla ya definida en la feature 001).
- El usuario borra su cuenta de Saveria: se borran también todas sus cuentas y movimientos, en el
  servidor y en el teléfono.
- Una cuenta archivada se puede volver a activar. Si mientras estaba archivada se creó otra
  activa con el mismo nombre (por ejemplo, dos "Nequi"), al reactivarla se pide renombrarla
  primero; si ya hay 20 cuentas activas, se pide archivar otra antes.
- Si la descripción supera el máximo, no se deja escribir más.

## Requirements *(mandatory)*

### Functional Requirements

**Registro de gastos e ingresos**

- **FR-001**: Los usuarios MUST poder registrar un gasto o un ingreso con monto, categoría,
  cuenta, fecha y una descripción opcional de máximo 120 caracteres.
- **FR-002**: El formulario MUST abrir con el tipo "gasto", la cuenta por defecto del usuario y la
  fecha de hoy ya seleccionados, de modo que registrar un gasto típico tome máximo 3 toques además
  de escribir el monto.
- **FR-003**: Las categorías MUST ser la lista fija del producto: 18 de gasto y 8 de ingreso, cada
  una con un identificador estable independiente de su nombre visible. No existen categorías
  creadas por el usuario.
- **FR-004**: El formulario MUST mostrar solo las categorías del tipo elegido.
- **FR-005**: El monto MUST ser mayor que cero, de máximo 12 dígitos enteros y con como mucho los
  decimales que permite la moneda de la cuenta.
- **FR-006**: Todo movimiento MUST usar la moneda de su cuenta y conservar su monto original
  exacto, sin redondeos.
- **FR-007**: La fecha de un movimiento MUST ser hoy o una fecha pasada, sin límite hacia atrás;
  no se permiten fechas futuras (los movimientos programados llegan con los recurrentes, v2).
  "Hoy" es el día según la hora del teléfono del usuario.
- **FR-008**: El sistema MUST impedir registrar movimientos y crear cuentas mientras el usuario no
  tenga moneda principal (regla FR-015 de la feature 001).
- **FR-009**: El registro manual MUST pasar por el mismo caso de uso que usará después el registro
  por IA; no se duplica la lógica de guardar movimientos. El formato de las acciones que
  propondrá la IA para gastos, ingresos y transferencias queda definido en esta feature, aunque
  la IA llegue después (feature 004).

**Historial y saldos**

- **FR-010**: El saldo de una cuenta MUST ser su saldo inicial más los ingresos, más las
  transferencias que entran, menos los gastos, menos las transferencias que salen, más o menos los
  ajustes.
- **FR-011**: El historial MUST mostrar los movimientos del más reciente al más antiguo,
  agrupados por día, y permitir filtrarlos por cuenta.
- **FR-012**: Cada saldo MUST mostrarse en la moneda de su cuenta. El sistema MUST NOT mostrar un
  total que sume cuentas de monedas distintas; el total consolidado en la moneda principal llega
  con las tasas de cambio (feature 008).
- **FR-013**: Cuando todas las cuentas activas estén en la moneda principal, el sistema MUST
  mostrar también el total de todas ellas. Las cuentas archivadas no suman en el total.
- **FR-014**: Un saldo MAY ser negativo. El sistema MUST registrar el movimiento sin aviso ni
  confirmación adicional y mostrar el saldo negativo destacado visualmente.

**Cuentas**

- **FR-015**: Los usuarios MUST poder crear cuentas con nombre (máximo 40 caracteres), tipo
  (efectivo, billetera digital o banco), moneda y saldo inicial (puede ser cero o negativo).
- **FR-016**: La moneda de una cuenta nueva MUST venir preseleccionada con la moneda principal del
  usuario.
- **FR-017**: El nombre de una cuenta MUST ser único entre las cuentas activas del usuario, sin
  distinguir mayúsculas.
- **FR-018**: Los usuarios MUST poder renombrar una cuenta y cambiar su tipo y su saldo inicial.
- **FR-019**: La moneda de una cuenta MUST poder cambiarse solo mientras la cuenta no tenga
  movimientos.
- **FR-020**: Siempre MUST existir exactamente una cuenta por defecto entre las activas. Marcar
  otra como cuenta por defecto quita la marca a la anterior.
- **FR-021**: Los usuarios MUST poder archivar una cuenta que no sea la cuenta por defecto, con
  cualquier saldo, y volver a activarla después. Antes de archivar, el sistema MUST avisar el
  saldo que tiene. Una cuenta archivada no aparece en la lista principal ni al elegir cuenta para
  un movimiento nuevo, y su saldo no suma en el total (FR-013); se ve en "cuentas archivadas" con
  su saldo, y sus movimientos se conservan y siguen visibles en el historial. Reactivar una cuenta
  MUST cumplir las mismas reglas que crearla: si su nombre ya lo usa otra cuenta activa, el
  sistema pide renombrarla antes (FR-017); si ya hay 20 cuentas activas, pide archivar otra
  antes (FR-023).
- **FR-022**: Las cuentas MUST NOT poder borrarse en esta feature; solo archivarse.
- **FR-023**: Un usuario MUST poder tener hasta 20 cuentas activas.

**Edición y borrado**

- **FR-024**: Los usuarios MUST poder editar el monto, la categoría, la cuenta, la fecha y la
  descripción de un movimiento, con las mismas reglas que al crearlo.
- **FR-025**: Al mover un movimiento a una cuenta de otra moneda, el sistema MUST pedir el monto
  en la nueva moneda; nunca convierte solo.
- **FR-026**: Los usuarios MUST poder borrar un movimiento con un solo toque, sin confirmación
  previa. El borrado quita el movimiento del historial y de los saldos, y el sistema MUST ofrecer
  "Deshacer" durante al menos 5 segundos. Deshacer restaura el movimiento tal como estaba.

**Transferencias**

- **FR-027**: Los usuarios MUST poder transferir dinero entre dos cuentas propias distintas, con
  fecha y descripción opcional.
- **FR-028**: Una transferencia MUST NOT llevar categoría ni contar como gasto o ingreso.
- **FR-029**: Si las cuentas tienen distinta moneda, el sistema MUST pedir el monto que sale y el
  que entra, sin calcular ninguna tasa.
- **FR-030**: Una transferencia MUST crearse, editarse y borrarse como una sola operación: las dos
  cuentas cambian juntas o ninguna cambia, también sin conexión y al enviarse al servidor.

**Ajuste de saldo**

- **FR-031**: Los usuarios MUST poder indicar el saldo real de una cuenta; el sistema registra un
  movimiento de ajuste por la diferencia, sin modificar ningún movimiento existente.
- **FR-032**: Un ajuste MUST NOT llevar categoría ni contar como gasto o ingreso, y MUST
  distinguirse en el historial.
- **FR-033**: Si el saldo real coincide con el actual, el sistema MUST NOT crear un ajuste.

**Sin conexión y envío al servidor**

- **FR-034**: Crear, editar y borrar cuentas y movimientos MUST funcionar sin conexión, con
  efecto inmediato en el teléfono.
- **FR-035**: Los cambios hechos en el teléfono MUST enviarse al servidor automáticamente cuando
  haya conexión, en el orden en que se hicieron, usando la cola de cambios de la feature 001.
- **FR-036**: Reenviar el mismo cambio MUST NOT duplicarlo en el servidor: cada cuenta y cada
  movimiento tiene un identificador creado en el teléfono.
- **FR-037**: Si el servidor rechaza un cambio por datos inválidos, el sistema MUST conservar el
  movimiento o la cuenta en el teléfono (y en los saldos), marcarlo como "no se pudo guardar" con
  el motivo, y permitir corregirlo o borrarlo; al corregirlo, el envío se reintenta. Un rechazo
  MUST NOT bloquear el envío de los demás cambios.
- **FR-038**: Descargar en un teléfono los cambios hechos en otro y resolver conflictos entre
  dispositivos queda fuera de esta feature (feature 006).

**Privacidad**

- **FR-039**: Un usuario MUST ver y modificar solo sus propias cuentas y movimientos.
- **FR-040**: Los registros técnicos (logs) MUST NOT contener montos ni descripciones asociados a
  un usuario.
- **FR-041**: Al borrar la cuenta de Saveria, el sistema MUST borrar todas las cuentas y
  movimientos del usuario, en el servidor y en el teléfono.

### Key Entities

- **Cuenta**: lugar donde el usuario tiene dinero. Nombre, tipo (efectivo, billetera digital,
  banco), moneda, saldo inicial, si es la cuenta por defecto y si está archivada. Su saldo se
  calcula con sus movimientos; no se guarda a mano. Ya existe "Efectivo", creada en la feature
  001.
- **Categoría**: entrada de la lista fija del producto. Identificador estable, nombre visible y
  tipo (gasto o ingreso). Igual para todos los usuarios.
- **Movimiento**: un gasto, un ingreso, una transferencia o un ajuste. Pertenece a un usuario.
  Tiene monto exacto, moneda (la de su cuenta), fecha y descripción opcional. Gastos e ingresos
  tienen categoría; transferencias y ajustes no. Una transferencia une una cuenta de origen y una
  de destino, con el monto que sale y el que entra.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario registra un gasto típico (cuenta y fecha por defecto) en menos de
  5 segundos y con máximo 3 toques además de escribir el monto.
- **SC-002**: El 100 % de los movimientos registrados sin conexión llega al servidor al volver
  la conexión, sin duplicados ni pérdidas, en las pruebas con cortes de red.
- **SC-003**: En el 100 % de los casos de prueba, el saldo de cada cuenta coincide al centavo con
  el saldo inicial más la suma de sus movimientos, en el teléfono y en el servidor.
- **SC-004**: Con 5.000 movimientos guardados, el historial y los saldos aparecen en menos de
  1 segundo al abrirlos, también sin conexión.
- **SC-005**: El 90 % de los usuarios de prueba registra su primer gasto sin ayuda la primera vez
  que lo intenta.
- **SC-006**: Ningún log contiene montos ni descripciones de movimientos asociados a un usuario.

## Assumptions

- La cuenta "Efectivo" y la cola de cambios del teléfono ya existen (feature 001) y se
  reutilizan.
- Las categorías y sus nombres visibles son los de `docs/vision-fase-0.md`; los íconos o colores
  de cada categoría se definen en el diseño, no en esta spec.
- Los decimales permitidos por moneda siguen el estándar internacional de monedas (por ejemplo,
  COP sin decimales en la app, USD y EUR con 2).
- Las cuentas no se conectan con ningún banco; el usuario las alimenta a mano.
- Reglas propuestas por el usuario y aceptadas sin pregunta formal: ninguna cuenta se borra en
  esta feature, tampoco "Efectivo", que solo se archiva si deja de ser la cuenta por defecto
  (FR-022, FR-020); la moneda de una cuenta con movimientos no se puede cambiar (FR-019).
- Fuera de alcance: resumen del mes y gasto por categoría (007); tasas de cambio y totales
  consolidados en la moneda principal (008); descargar cambios de otros dispositivos y resolver
  conflictos (006); registro por IA, memoria de conceptos y categorización automática (004/005);
  deudas, movimientos recurrentes, metas y bolsillos (v2).
