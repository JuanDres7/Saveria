# Feature Specification: Rediseño visual de la app

**Feature Branch**: `feat/003-visual-redesign`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Rediseño visual de la app: que Saveria deje de verse como un prototipo y tenga una identidad visual propia, cálida y tranquila, aplicada de forma coherente a todas las pantallas que ya existen, sin agregar funciones nuevas. La dirección visual sale de la imagen de referencia `inspiracion/Inspiracion.png`: se toma su estilo (verdes oliva sobre fondo crema, tarjetas muy redondeadas, íconos de línea, barra de navegación inferior, filtros en chips, movimientos con ícono redondo y monto en rojo o verde, mensajes amables), no sus funciones bancarias."

## Clarifications

### Session 2026-11-09

- Q: ¿Cómo se dibujan los íconos de línea fina, si la app no trae ninguna librería de íconos y la constitución prohíbe agregar herramientas sin una enmienda? → A: Se enmienda la constitución para permitir librerías y herramientas útiles para la interfaz (íconos, formas vectoriales, etc.); el plan elige cuáles. La enmienda es el primer paso de esta feature.
- Q: ¿Qué secciones lleva la barra de navegación inferior? → A: Cuatro: Inicio, Movimientos, Cuentas y Ajustes (ajustado en la revisión de abajo: se suma un botón «+» central para registrar).
- Q: ¿Qué muestra la tarjeta grande de balance de Inicio? → A: El total cuando todas las cuentas activas están en la moneda principal; si no, el saldo de la cuenta por defecto, diciéndolo claramente. Las demás cuentas van debajo.
- Q: ¿Habrá modo oscuro en esta feature? → A: Sí, claro y oscuro: dos paletas y todas las pantallas probadas en ambos modos.
- Q: ¿Qué tipografía se usa? → A: La del sistema (ajustado en la revisión de abajo: solo para el texto corrido).
- Q: ¿Cuánto tono amable y motivador llevan los textos? → A: Cercano y breve: saludo por nombre y mensajes amables solo donde no hay datos o tras lograr algo; nunca en acciones delicadas.

### Revisión 2026-11-09 (segunda propuesta visual, «La hoja de Saveria»)

Tras ver una segunda propuesta con maquetas en claro y oscuro, el dueño del proyecto la aprobó y quedaron estos ajustes. Reemplazan a las respuestas de arriba donde chocan.

- Q: ¿Se mantiene solo la tipografía del sistema? → A: No. El texto corrido usa la del sistema; una sola letra de identidad, incluida dentro de la app (sin descargas ni conexión), se usa en títulos y cifras grandes.
- Q: ¿Cómo se muestran los gastos? → A: Con signo menos y en el color del texto. El verde queda para los ingresos y el rojo solo para saldos negativos y errores.
- Q: ¿Cómo se registra un movimiento desde cualquier sección? → A: Con un botón «+» al centro de la barra inferior, visible en las cuatro secciones y solo si el usuario ya tiene moneda principal. Inicio ya no lleva un botón ancho de «Registrar movimiento».
- Q: ¿Qué forma propia tiene la app? → A: La forma de hoja de la marca (dos esquinas muy redondeadas y dos casi rectas) en la tarjeta de balance y en el botón «+»; las categorías usan cuatro tonos suaves según su grupo.
- Q: ¿El diseño debe contemplar desde ya dónde irán los módulos que llegan después (registro por IA, resumen, recurrentes, deudas, metas, asistente)? → A: Sí. El lugar de cada uno queda fijado en `docs/mapa-de-la-app.md`; este rediseño deja lista la estructura para que entren sin rehacer la navegación, pero no construye ninguna de esas funciones. Ajustes sigue como sección de la barra hasta que llegue la conversación con la IA.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inicio con identidad propia (Priority: P1)

El usuario abre Saveria y ve una pantalla de Inicio cuidada y tranquila: un saludo con su nombre,
una tarjeta grande con su balance, sus cuentas de dinero y sus últimos movimientos, todo con la
misma paleta, formas y tipografía. Al verla entiende de un vistazo cuánto tiene y qué pasó
últimamente.

**Why this priority**: Inicio es la pantalla que más se ve y la que define la primera impresión de
la app; es donde la identidad visual se nota más.

**Independent Test**: con una cuenta que tiene varias cuentas de dinero y movimientos, se abre
Inicio y se comprueba que muestra el saludo, la tarjeta de balance, las cuentas y los últimos
movimientos con el estilo nuevo, y que los números son los mismos que antes del rediseño.

**Acceptance Scenarios**:

1. **Given** un usuario con sesión iniciada, **When** abre Inicio, **Then** ve un saludo con su
   nombre, una tarjeta grande de balance y sus cuentas de dinero, sobre un fondo crema con formas
   suaves.
2. **Given** un usuario con todas sus cuentas activas en su moneda principal, **When** mira la
   tarjeta de balance, **Then** ve el total; si tiene cuentas en monedas distintas, la tarjeta muestra
   el saldo de su cuenta por defecto diciendo de qué cuenta es, nunca un total que las mezcle (regla
   de la feature 002).
3. **Given** movimientos recientes, **When** los ve en Inicio, **Then** cada uno muestra un ícono
   redondo de su categoría, su título, cuenta, fecha y monto, con los gastos con signo menos y los
   ingresos en verde con signo más.
4. **Given** una cuenta de dinero con saldo negativo, **When** la ve, **Then** el saldo aparece
   destacado en rojo sin perder legibilidad.
5. **Given** un usuario sin movimientos, **When** abre Inicio, **Then** ve un mensaje amable que lo
   invita a registrar el primero con el botón «+», en vez de una lista vacía.
6. **Given** un usuario sin conexión, **When** abre Inicio, **Then** ve la misma pantalla y los mismos
   datos que con conexión.

---

### User Story 2 - Registrar un movimiento con el nuevo estilo (Priority: P1)

El usuario registra un gasto o un ingreso en una pantalla con la misma identidad: las categorías se
reconocen por su ícono y su nombre, la cuenta y la fecha son chips claros y el botón principal es
ancho y fácil de alcanzar. Registrar sigue siendo igual de rápido.

**Why this priority**: registrar es la acción central del producto; el rediseño no puede hacerla más
lenta ni más difícil.

**Independent Test**: se registra un gasto típico (cuenta y fecha por defecto) y se cuentan los
toques y el tiempo; se comprueba que cada categoría se reconoce por su ícono.

**Acceptance Scenarios**:

1. **Given** el formulario de registro, **When** el usuario ve las categorías, **Then** cada una
   tiene un ícono propio de línea fina y su nombre, y las de gasto se distinguen de las de ingreso.
2. **Given** el formulario abierto, **When** escribe el monto, toca la categoría y guarda, **Then**
   el gasto queda registrado en máximo 3 toques además de escribir el monto, igual que antes del
   rediseño.
3. **Given** el teclado abierto, **When** el usuario toca una categoría, **Then** el botón de guardar
   queda a la vista sin que el teclado lo tape.
4. **Given** un error en el formulario (sin monto, sin categoría), **When** intenta guardar,
   **Then** el mensaje aparece junto al campo con un color y un texto que se leen con claridad.
5. **Given** el usuario edita un movimiento o hace una transferencia, **When** ve esas pantallas,
   **Then** usan los mismos elementos que el formulario de registro.

---

### User Story 3 - Entrar y empezar con la misma identidad (Priority: P1)

Una persona nueva abre Saveria y recorre la bienvenida, el registro, el inicio de sesión y el
onboarding. Desde la primera pantalla la app se ve cuidada y coherente con el resto, y cada paso del
onboarding se siente guiado y amable.

**Why this priority**: es lo primero que ve un usuario nuevo; una entrada que parece un prototipo
resta confianza en una app que maneja dinero.

**Independent Test**: se recorre sin sesión desde la bienvenida hasta terminar el onboarding y se
comprueba que todas las pantallas comparten identidad y que ningún paso cambió de comportamiento.

**Acceptance Scenarios**:

1. **Given** una persona sin sesión, **When** abre la app, **Then** ve una bienvenida con la
   identidad nueva y dos acciones claras: crear cuenta e iniciar sesión.
2. **Given** los formularios de registro, inicio de sesión y recuperar contraseña, **When** los ve,
   **Then** campos, botones, enlaces y errores usan los mismos estilos que el resto de la app.
3. **Given** el onboarding, **When** avanza por sus cinco pasos, **Then** cada paso muestra su avance
   y mantiene la identidad, y las opciones elegidas se ven claramente marcadas.
4. **Given** la casilla de aceptar la política de datos, **When** está marcada o sin marcar, **Then**
   se distingue con claridad y su nombre accesible no cambia.

---

### User Story 4 - Navegar con una barra inferior (Priority: P2)

El usuario se mueve entre las secciones principales con una barra de navegación inferior, siempre a
la mano, con íconos de línea y la sección actual claramente marcada, en vez de depender de los
enlaces de Inicio.

**Why this priority**: hoy casi todo se alcanza desde Inicio con enlaces de texto; una barra
inferior es la forma habitual y más cómoda de navegar en el teléfono, pero cambia la estructura y
por eso va después de las pantallas principales.

**Independent Test**: desde cualquier sección principal se llega a las demás con un solo toque y la
sección actual se ve marcada.

**Acceptance Scenarios**:

1. **Given** el usuario en una sección principal, **When** mira la parte inferior, **Then** ve la
   barra con cuatro secciones (Inicio, Movimientos, Cuentas y Ajustes), la actual marcada, y al
   centro el botón «+» para registrar un movimiento.
2. **Given** la barra de navegación, **When** toca otra sección, **Then** llega a ella con un solo
   toque y vuelve donde estaba al regresar.
3. **Given** una pantalla de detalle o de formulario (editar, transferir, ajustar saldo), **When**
   está abierta, **Then** la barra no estorba y el botón de guardar sigue a la vista.
4. **Given** el usuario sin conexión, **When** navega por la barra, **Then** todo funciona igual.
5. **Given** una persona sin sesión o en el onboarding, **When** ve la app, **Then** no aparece la
   barra (solo existe con la sesión iniciada y el onboarding terminado).
6. **Given** que registrar y transferir no tienen sección propia, **When** el usuario toca el botón
   «+» desde cualquiera de las cuatro secciones, **Then** abre «Registrar movimiento» con un toque;
   «Transferir» se alcanza desde Inicio y desde el detalle de una cuenta, donde también hay un acceso a
   «Registrar movimiento».
7. **Given** un usuario sin moneda principal, **When** mira la barra, **Then** no aparece el botón «+»
   (misma regla que hoy: sin moneda principal no se puede registrar).

---

### User Story 5 - Historial y cuentas con el nuevo estilo (Priority: P2)

El usuario consulta su historial y administra sus cuentas de dinero con la identidad nueva:
filtros en chips, movimientos con su ícono, tarjetas redondeadas para cada cuenta y formularios
coherentes.

**Why this priority**: son las pantallas de consulta y administración; completan la coherencia
después de Inicio y del registro.

**Independent Test**: se recorren historial, lista de cuentas, nueva cuenta, detalle, archivadas y
ajustar saldo, y se comprueba que todas usan los mismos componentes y que cada acción hace lo mismo
que antes.

**Acceptance Scenarios**:

1. **Given** el historial, **When** el usuario lo abre, **Then** ve los movimientos agrupados por día
   con su ícono, título, cuenta y monto, y chips para filtrar por cuenta.
2. **Given** la lista de cuentas, **When** la ve, **Then** cada cuenta es una tarjeta redondeada con su
   nombre, tipo, saldo en su moneda y la marca de cuenta por defecto.
3. **Given** el detalle de una cuenta, **When** archiva, reactiva, ajusta el saldo o la marca por
   defecto, **Then** las acciones mantienen su comportamiento y sus avisos, con la nueva presentación.
4. **Given** un movimiento o una cuenta que el servidor rechazó, **When** el usuario lo ve, **Then** la
   marca "no se pudo guardar" (o "no se pudo borrar") es visible y clara, con su motivo.
5. **Given** un historial largo, **When** se desplaza, **Then** sigue cargando por páginas con la misma
   fluidez de antes.

---

### User Story 6 - Configuración y avisos coherentes (Priority: P3)

Configuración, cambiar contraseña, borrar cuenta, el bloqueo de verificación de correo y los avisos
(Deshacer, correo sin verificar) se ven con la misma identidad, y los mensajes usan un tono cercano
y amable sin perder claridad, sobre todo en acciones delicadas como borrar la cuenta.

**Why this priority**: son pantallas de uso poco frecuente; importan para la coherencia, pero no
bloquean el uso diario.

**Independent Test**: se recorren Configuración y sus pantallas, el bloqueo de verificación y los
avisos, y se comprueba que usan los mismos elementos y que los textos de acciones delicadas siguen
siendo inequívocos.

**Acceptance Scenarios**:

1. **Given** Configuración, **When** el usuario la abre, **Then** sus opciones se agrupan en tarjetas
   redondeadas con la identidad nueva.
2. **Given** borrar la cuenta, **When** el usuario llega a esa pantalla, **Then** el texto deja
   completamente claro que es definitivo, sin suavizarlo con un tono motivador.
3. **Given** el aviso "Movimiento borrado · Deshacer" o "Confirma tu correo", **When** aparecen,
   **Then** se ven con el estilo nuevo, legibles sobre cualquier fondo, y siguen visibles el mismo
   tiempo que antes.
4. **Given** el bloqueo por correo sin verificar, **When** aparece, **Then** conserva su
   comportamiento y su claridad con el estilo nuevo.

---

---

### User Story 7 - Modo claro y modo oscuro (Priority: P2)

El usuario usa Saveria con el aspecto claro (crema y verdes) o con un aspecto oscuro, según como
tenga configurado su teléfono. En los dos se lee bien y conserva la misma identidad: mismos íconos,
mismas formas y el mismo tono verde reconocible.

**Why this priority**: mucha gente usa su teléfono en modo oscuro, sobre todo de noche; una app que
maneja dinero debe leerse cómoda en ambos. Va después de las pantallas principales porque reutiliza
todo lo anterior.

**Independent Test**: se recorren todas las pantallas con el teléfono en modo claro y en modo
oscuro y se comprueba que ninguna pierde legibilidad, información ni identidad.

**Acceptance Scenarios**:

1. **Given** un teléfono en modo claro, **When** el usuario abre la app, **Then** ve la paleta crema y
   verde oliva.
2. **Given** un teléfono en modo oscuro, **When** el usuario abre la app, **Then** ve una paleta oscura
   con los mismos verdes como acento, y todo el texto y los íconos se leen con claridad.
3. **Given** el usuario con la app abierta, **When** cambia el modo del teléfono, **Then** la app
   cambia de aspecto sin cerrarse, sin perder la pantalla en la que estaba ni lo que tenía escrito.
4. **Given** gastos, ingresos y saldos negativos, **When** se ven en modo oscuro, **Then** el verde de
   los ingresos y el rojo de los saldos negativos se distinguen y se leen, y los gastos conservan su
   signo menos con el texto legible.
5. **Given** los avisos, las tarjetas, los chips y los campos, **When** se ven en modo oscuro,
   **Then** se distinguen del fondo con el mismo nivel de claridad que en modo claro.

---

### Edge Cases

- Textos largos: un nombre de cuenta de 40 caracteres o un monto de 12 dígitos no se corta ni rompe
  la tarjeta; se ajusta o se abrevia sin perder el valor completo disponible.
- Tamaño de letra del sistema agrandado: ninguna pantalla pierde botones ni textos; todo se puede
  alcanzar desplazándose.
- Teléfonos pequeños: el botón principal y la barra inferior siguen visibles y alcanzables.
- Teclado abierto: el botón de guardar nunca queda tapado (regla de la feature 002).
- Usuario con 20 cuentas activas: la lista y la tarjeta de balance siguen siendo legibles.
- Montos muy grandes o saldos negativos: se leen completos y se distinguen por color y por signo, no
  solo por color.
- Sin conexión o con envío pendiente: los mismos avisos de antes, con la nueva presentación.
- Personas que no distinguen el rojo del verde: gastos e ingresos se diferencian por el signo (− o +) y
  por el ícono, no solo por el color.
- Formas y figuras de fondo: nunca quedan detrás del texto de modo que lo hagan difícil de leer, ni
  en modo claro ni en modo oscuro.
- Cambio de modo con la app abierta, o con un formulario a medias: no se pierde lo escrito ni la
  pantalla actual.
- Pantallas de arranque y de carga: tampoco "destellan" en blanco al abrir en modo oscuro.

## Requirements *(mandatory)*

### Functional Requirements

**Identidad visual**

- **FR-001**: Todas las pantallas existentes MUST usar una misma paleta basada en verdes oliva (uno
  oscuro para la acción principal y uno claro para fondos de apoyo) sobre un fondo crema en modo
  claro, tomando como referencia la imagen `inspiracion/Inspiracion.png`.
- **FR-002**: Las tarjetas, los campos, los botones y los chips MUST tener esquinas muy redondeadas y
  un tono, borde o sombra suave que los separe del fondo, y los mismos estilos en todas las pantallas;
  la sombra se reserva para la tarjeta de balance y el botón «+».
- **FR-003**: El botón de acción principal MUST ser ancho, de verde oscuro, con texto claro y, cuando
  corresponda, un ícono; los botones secundarios y los enlaces MUST verse distintos del principal.
- **FR-004**: La app MUST usar la tipografía del sistema para el texto corrido, los montos de las
  listas y los campos, y una sola letra de identidad para los títulos y las cifras grandes. La letra
  de identidad MUST venir incluida en la app (sin descargas ni conexión) y, si no cargara, la app MUST
  seguir legible con la del sistema. Los tamaños y pesos siguen una escala fija, igual en todas las
  pantallas.
- **FR-005**: Los íconos MUST ser de línea fina y del mismo estilo en toda la app.
- **FR-006**: Las pantallas principales MUST tener formas orgánicas suaves de fondo que decoran sin
  competir con el contenido.
- **FR-007**: Los colores, medidas, radios, sombras y tipografías MUST definirse en un solo lugar de
  la app, de modo que un cambio de identidad no obligue a editar cada pantalla.

**Dinero y movimientos**

- **FR-008**: Los ingresos MUST mostrarse en verde con signo "+"; los gastos MUST mostrarse con signo
  "-" y en el color del texto; el rojo MUST reservarse para los saldos negativos y los errores. Ningún
  monto MUST depender solo del color para entenderse.
- **FR-009**: Cada una de las 26 categorías (18 de gasto y 8 de ingreso) MUST tener un ícono redondo
  propio, reconocible junto a su nombre; transferencias y ajustes MUST tener sus propios íconos. Los
  íconos de categoría MUST agruparse en cuatro tonos suaves de la paleta según el tipo de gasto (por
  ejemplo comida y compras, movilidad y viajes, salud y personas, casa y obligaciones), iguales en
  modo claro y oscuro salvo por su luminosidad.
- **FR-010**: Cada movimiento en las listas MUST mostrar ícono, título, cuenta, fecha (por día) y monto,
  en ese orden visual.
- **FR-011**: Inicio MUST mostrar, de arriba abajo, un saludo con el nombre del usuario, una tarjeta
  grande de balance, las cuentas de dinero en una fila que se desliza de lado y los últimos
  movimientos. Inicio no lleva un botón ancho de registrar: se registra con el botón «+» de la barra.
- **FR-012**: La tarjeta de balance MUST mostrar el total cuando todas las cuentas activas están en la
  moneda principal y, si no, el saldo de la cuenta por defecto indicando con claridad de qué cuenta
  es (por ejemplo «Saldo de Efectivo») y avisando que hay cuentas en otras monedas; las demás cuentas
  van debajo. Las cuentas archivadas no suman (reglas de la feature 002).
- **FR-013**: Una pantalla o lista sin datos MUST mostrar un mensaje amable que invite a la primera
  acción, en vez de quedar vacía.

**Navegación**

- **FR-014**: Con la sesión iniciada y el onboarding terminado MUST existir una barra de navegación
  inferior con cuatro secciones (Inicio, Movimientos, Cuentas y Ajustes), íconos de línea, la sección
  actual marcada y acceso a cada sección con un solo toque. Al centro de la barra MUST haber un botón
  «+» que abre «Registrar movimiento» desde cualquiera de las cuatro secciones, y MUST aparecer solo si
  el usuario ya tiene moneda principal (regla vigente de las features 001 y 002). Transferir se alcanza
  desde Inicio y desde el detalle de una cuenta, donde también hay un acceso a «Registrar movimiento».
- **FR-015**: La barra MUST ocultarse sin sesión, durante el onboarding y en el bloqueo por correo sin
  verificar, y MUST NOT tapar el botón de guardar de los formularios; el botón «+» sigue a la barra.
- **FR-016**: Las pantallas de detalle y de formulario MUST conservar una forma clara de volver atrás.

**Textos**

- **FR-017**: Los textos de la app MUST estar en español de Colombia, con un tono cercano y breve: saludo
  por nombre y mensajes amables solo donde no hay datos o tras lograr algo; el resto de los textos y
  los mensajes de error MUST ser claros y concretos.
- **FR-018**: Las acciones delicadas (borrar la cuenta, borrar un movimiento, cerrar sesión con
  cambios pendientes) MUST mantener textos inequívocos, sin tono motivador ni eufemismos.

**Sin cambios de comportamiento**

- **FR-019**: El rediseño MUST NOT agregar funciones: no hay gráficos, resumen del mes, metas, mapa,
  foto de perfil ni tarjetas de crédito; lo que la imagen de referencia muestra y Saveria aún no
  tiene queda fuera.
- **FR-020**: Cada pantalla MUST conservar el comportamiento, las reglas y los resultados que tenía
  antes del rediseño (cuentas, movimientos, sincronización, avisos y errores). Las únicas excepciones
  son el lugar de los atajos que la nueva navegación mueve: registrar pasa al botón «+», y «Cuentas de
  dinero», «Configuración» y «Cerrar sesión» pasan a la barra y a Ajustes.
- **FR-021**: Registrar un gasto o un ingreso típico MUST seguir costando máximo 3 toques además de
  escribir el monto, y todo MUST seguir funcionando sin conexión.
- **FR-022**: Los nombres accesibles de botones, campos y opciones que ya existen MUST conservarse, de
  modo que las pruebas y los lectores de pantalla sigan reconociéndolos.

**Accesibilidad**

- **FR-023**: El texto y los íconos MUST tener un contraste suficiente con su fondo para leerse con
  comodidad, incluidos los textos sobre los verdes y sobre las tarjetas.
- **FR-024**: Todo elemento que se toca MUST tener un tamaño cómodo para el dedo.
- **FR-025**: Los textos MUST poder agrandarse con el tamaño de letra del sistema sin perder
  información ni controles.
- **FR-026**: Ninguna información MUST depender solo del color: siempre hay también signo, ícono o
  texto.

**Modo claro y modo oscuro**

- **FR-027**: La app MUST tener dos variantes de la identidad: una clara (crema y verdes) y una oscura,
  con los mismos verdes como acento, los mismos íconos y las mismas formas.
- **FR-028**: La app MUST seguir automáticamente el modo que tenga el teléfono, y cambiar de aspecto
  al instante si el usuario lo cambia con la app abierta; no hay un interruptor propio en esta feature.
- **FR-029**: Todos los requisitos de legibilidad y accesibilidad (FR-008, FR-023 a FR-026) MUST
  cumplirse en ambos modos, incluidos el verde de los ingresos, el rojo de los saldos negativos y
  los errores, los avisos y los campos.
- **FR-030**: Cambiar de modo MUST NOT perder la pantalla actual ni lo que el usuario tenía escrito.

**Lugar para lo que viene**

- **FR-032**: La barra inferior, Inicio, Registrar, Movimientos, Cuentas y Ajustes MUST quedar organizados
  de modo que los módulos futuros del mapa de la app (`docs/mapa-de-la-app.md`) entren en el lugar ya
  previsto sin mover lo que el usuario ya conoce. Esta feature MUST NOT mostrar ninguna de esas funciones
  ni dejar espacios vacíos o avisos de «próximamente» (ver FR-019).

**Forma de la marca**

- **FR-031**: La tarjeta de balance de Inicio y el botón «+» de la barra MUST tener la forma de hoja de
  la marca (dos esquinas opuestas muy redondeadas y las otras dos casi rectas), igual en modo claro y
  oscuro; la tarjeta de balance es la única pieza de verde oscuro lleno de la pantalla de Inicio.

### Key Entities

- **Identidad visual (tema)**: conjunto de colores con nombre por su significado (acción principal,
  fondo, texto, dinero que entra, dinero que sale, avisos), tamaños de texto, radios, sombras y
  espacios, con una variante clara y una oscura; es la única fuente de la apariencia.
- **Ícono de categoría**: imagen de línea, con un tono suave según el grupo de la categoría, asociada a
  cada una de las 26 categorías, y a las transferencias y los ajustes; solo representa, no cambia los datos del movimiento.
- **Sección de navegación**: cada destino de la barra inferior, con su ícono, su nombre y su estado de
  seleccionada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las pantallas existentes usa la misma paleta, tipografía, radios e
  íconos; no queda ninguna con el aspecto de prototipo.
- **SC-002**: Todo el texto cumple un contraste de al menos 4,5 a 1 con su fondo (3 a 1 en texto grande
  e íconos), medido en las pantallas principales, en modo claro y en modo oscuro.
- **SC-003**: Todo elemento tocable mide al menos 48 por 48 unidades de pantalla de área de toque.
- **SC-004**: Registrar un gasto típico sigue tomando máximo 3 toques más el monto y menos de 5
  segundos, igual que antes del rediseño.
- **SC-005**: Las pantallas siguen funcionando con el tamaño de letra del sistema al 150 % sin que se
  pierda ningún botón ni texto.
- **SC-006**: Todas las pruebas de comportamiento existentes siguen pasando: el rediseño no cambia
  ningún resultado.
- **SC-007**: Un cambio de identidad (por ejemplo, el color de la acción principal) se hace en un solo
  lugar y se refleja en el 100 % de las pantallas.
- **SC-008**: El dueño del proyecto aprueba cada grupo de pantallas comparándolo con la imagen de
  referencia y con las propuestas elegidas antes de implementar, en modo claro y en modo oscuro.
- **SC-009**: El 100 % de las pantallas se recorre en modo claro y en modo oscuro sin perder
  legibilidad ni información, y el cambio de modo con la app abierta no pierde la pantalla ni lo
  escrito.

## Assumptions

- La imagen `inspiracion/Inspiracion.png` es de una app bancaria modificada por el dueño del proyecto;
  sirve para el estilo, no para las funciones. Antes de implementar se le muestran propuestas visuales
  para que elija (paleta clara y oscura, estilo de íconos, forma de las tarjetas). La propuesta
  elegida («La hoja de Saveria») y su paleta están aprobadas.
- Decisiones ya confirmadas (ver Clarifications): barra de cuatro secciones con botón «+» central,
  tarjeta de balance con el total o la cuenta por defecto, modo claro y oscuro, letra del sistema para
  el texto corrido y una letra de identidad en títulos y cifras grandes, gastos en el color del texto,
  forma de hoja y tono cercano y breve.
- Valores por defecto: el modo oscuro se activa solo con el modo del teléfono, sin un interruptor
  propio.
- El mapa de la app (`docs/mapa-de-la-app.md`) define dónde vivirá cada módulo futuro de la visión. Es un
  documento del proyecto, no de esta feature: cada funcionalidad nueva lo revisa en su plan.
- **Constitución**: esta feature incluye una enmienda (primer paso) que permite librerías y
  herramientas útiles para la interfaz (íconos, formas vectoriales y similares), antes prohibidas sin
  enmienda. Quedan prohibidos igual los servicios y herramientas de otro tipo de la lista de la
  constitución. El plan elige las librerías concretas, justificando cada una.
- Solo Android, solo español de Colombia, en teléfono; tabletas, iOS y otros idiomas quedan fuera.
- Los colores y medidas ya viven en un solo archivo (`apps/mobile/src/theme.ts`, sin colores sueltos),
  así que el rediseño parte de ahí.
- Fuera de alcance: interruptor propio de modo claro/oscuro, animaciones elaboradas, ilustraciones
  nuevas más allá de formas de fondo, la forma de hoja e íconos, gráficos, resumen del mes, metas, mapa, foto de perfil y
  cualquier otra función de la imagen que Saveria aún no tiene.
