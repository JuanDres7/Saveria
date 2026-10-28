# Feature Specification: Registro, inicio de sesión y onboarding

**Feature Branch**: `001-auth-onboarding`

**Created**: 2026-10-22

**Status**: Ready

**Input**: User description: "Registro, inicio de sesión, onboarding y configuración de perfil: el usuario crea su cuenta con correo y contraseña aceptando la política de datos, inicia sesión, responde un onboarding corto (cómo quiere que la IA lo llame, país, ciudad, moneda principal y modo de la IA manual o automático) y puede cambiar todo eso después desde Configuración. Incluye borrar la cuenta y todos sus datos."

## Clarifications

### Session 2026-10-22

- Q: Cuando el usuario abre el enlace de verificación o de recuperación que le llega por correo, ¿dónde ocurre la acción? → A: En una página web mínima servida por el backend; después el usuario vuelve a la app (sin deep links en el MVP).
- Q: ¿Qué pasa con los movimientos sin sincronizar cuando el usuario cierra sesión a propósito? → A: Se conservan en el dispositivo, cifrados, separados por usuario y sin mostrarse a nadie; se sincronizan cuando ese mismo usuario vuelve a entrar. Al cerrar sesión se muestra un aviso informativo con la cantidad pendiente, sin pedir ninguna decisión.
- Q: ¿Sobre qué se cuentan los intentos fallidos de inicio de sesión que activan el bloqueo? → A: Sobre la combinación de IP de origen + correo; la cuenta en sí nunca se bloquea, para que un tercero no pueda dejar fuera al dueño.
- Q: ¿Puede el usuario cambiar su contraseña desde Configuración sabiendo la actual? → A: Sí; pide la contraseña actual y la nueva, cierra todas las demás sesiones y mantiene activa la actual.
- Q: Pasados los 7 días sin verificar, ¿la app se bloquea también sin conexión? → A: No; el bloqueo solo aparece con conexión, cuando el servidor confirma que el correo sigue sin verificar. Sin conexión la app funciona normal.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear una cuenta y entrar (Priority: P1)

Una persona que descarga Saveria crea su cuenta con correo y contraseña, acepta la política de
tratamiento de datos y queda dentro de la app con la sesión iniciada. Más adelante puede cerrar
sesión y volver a entrar con las mismas credenciales.

**Why this priority**: sin cuenta no existe ningún dato propio del usuario; es la base de todas
las demás funcionalidades.

**Independent Test**: se puede probar creando una cuenta nueva, cerrando sesión y volviendo a
entrar; entrega una identidad persistente para el usuario.

**Acceptance Scenarios**:

1. **Given** una persona sin cuenta, **When** ingresa un correo válido, una contraseña que cumple
   las reglas y acepta la política de datos, **Then** la cuenta se crea y la persona entra a la
   app con la sesión iniciada.
2. **Given** una persona en el formulario de registro, **When** intenta registrarse sin aceptar
   la política de datos, **Then** el registro no se completa y se le indica que la aceptación es
   obligatoria.
3. **Given** un correo ya registrado, **When** alguien intenta registrarse con ese correo,
   **Then** el registro se rechaza con un mensaje que no revela datos de la cuenta existente.
4. **Given** un usuario registrado sin sesión, **When** ingresa su correo y contraseña correctos,
   **Then** entra a la app y ve sus datos.
5. **Given** un usuario registrado, **When** ingresa una contraseña incorrecta, **Then** no entra
   y recibe un mensaje genérico que no indica si falló el correo o la contraseña.
6. **Given** un usuario con sesión iniciada, **When** cierra sesión, **Then** vuelve a la
   pantalla de inicio y sus datos dejan de estar visibles en el dispositivo hasta que vuelva a
   entrar.
7. **Given** un usuario con movimientos sin sincronizar, **When** cierra sesión sin conexión,
   **Then** ve un aviso con la cantidad pendiente, la sesión se cierra y, al volver a entrar con
   la misma cuenta y conexión, esos movimientos se sincronizan.

---

### User Story 2 - Onboarding inicial (Priority: P1)

Justo después de registrarse, el usuario responde un onboarding corto: cómo quiere que la IA lo
llame, en qué país y ciudad está, qué moneda principal usará (sugerida según el país) y qué modo
de IA prefiere. Al terminar, la app queda lista para registrar movimientos, con una cuenta
"Efectivo" creada en su moneda principal.

**Why this priority**: la moneda principal y la cuenta por defecto son requisito para registrar
cualquier movimiento; el nombre y el modo de IA definen la experiencia diferenciadora desde el
primer uso.

**Independent Test**: se puede probar registrando una cuenta nueva y completando el onboarding;
al final el usuario ve su moneda principal aplicada y una cuenta "Efectivo" lista para usar.

**Acceptance Scenarios**:

1. **Given** un usuario recién registrado, **When** llega al onboarding, **Then** se le piden en
   orden: nombre para la IA, país, ciudad, moneda principal y modo de IA.
2. **Given** un usuario que eligió Colombia como país, **When** llega al paso de moneda,
   **Then** el peso colombiano (COP) aparece preseleccionado y puede cambiarlo por otra moneda.
3. **Given** un usuario en el paso de modo de IA, **When** no cambia nada, **Then** queda
   seleccionado el modo manual, con una explicación breve de la diferencia entre manual y
   automático.
4. **Given** un usuario que completa el onboarding, **When** entra a la pantalla principal,
   **Then** existe una cuenta "Efectivo" en su moneda principal con saldo cero.
5. **Given** un usuario que cierra la app a mitad del onboarding, **When** vuelve a abrirla,
   **Then** continúa el onboarding desde el paso pendiente, conservando lo ya respondido.
6. **Given** un usuario que no completó el onboarding, **When** intenta usar la app, **Then** no
   puede registrar movimientos hasta elegir al menos su moneda principal.

---

### User Story 3 - Cambiar la configuración del perfil (Priority: P2)

Desde Configuración, el usuario puede cambiar en cualquier momento todo lo que eligió en el
onboarding: nombre para la IA, país, ciudad, moneda principal y modo de IA. También puede activar
monedas de referencia que se muestran al lado de los montos en su moneda principal.

**Why this priority**: las preferencias cambian (alguien se muda o prueba el modo automático), pero
la app ya es usable sin esta historia.

**Independent Test**: se puede probar cambiando cada ajuste desde Configuración y verificando que
el cambio se refleja en la app y se conserva al reiniciarla.

**Acceptance Scenarios**:

1. **Given** un usuario con modo de IA manual, **When** activa el modo automático en
   Configuración, **Then** se le muestra qué implica (las acciones de la IA se guardan sin
   preguntar y se pueden deshacer desde el historial) y el cambio queda activo tras confirmarlo.
2. **Given** un usuario con COP como moneda principal, **When** activa USD como moneda de
   referencia, **Then** los totales muestran también su equivalente en USD junto al valor en COP.
3. **Given** un usuario que cambia su moneda principal, **When** vuelve al resumen, **Then** los
   totales se muestran en la nueva moneda y sus movimientos anteriores conservan su monto y moneda
   originales.
4. **Given** un usuario sin conexión, **When** cambia un ajuste, **Then** el cambio se aplica en el
   dispositivo y se sincroniza al recuperar la conexión.
5. **Given** un usuario con sesión en dos dispositivos, **When** cambia su contraseña desde
   Configuración ingresando la actual y una nueva válida, **Then** el cambio se aplica, la sesión
   del otro dispositivo se cierra y la del dispositivo actual sigue activa.
6. **Given** un usuario en Configuración, **When** intenta cambiar su contraseña con una
   contraseña actual incorrecta, **Then** el cambio se rechaza y ninguna sesión se cierra.

---

### User Story 4 - Borrar la cuenta y todos los datos (Priority: P2)

El usuario puede borrar su cuenta desde Configuración. Tras confirmar, se eliminan su cuenta y
todos sus datos financieros, relatos y preferencias.

**Why this priority**: es una obligación legal (Ley 1581 de 2012) antes de abrir la app a usuarios
reales, aunque no bloquea el uso diario.

**Independent Test**: se puede probar creando una cuenta con datos, borrándola y verificando que
no se puede volver a entrar y que sus datos ya no existen.

**Acceptance Scenarios**:

1. **Given** un usuario con sesión iniciada, **When** solicita borrar su cuenta, **Then** se le
   pide confirmar con su contraseña y se le explica que la acción no se puede deshacer.
2. **Given** un usuario que confirma el borrado, **When** el proceso termina, **Then** la sesión se
   cierra, sus datos se eliminan del dispositivo y del servidor, y sus credenciales ya no permiten
   entrar.
3. **Given** una cuenta borrada, **When** alguien se registra después con el mismo correo,
   **Then** obtiene una cuenta nueva y vacía, sin datos de la anterior.

---

### User Story 5 - Mantener la sesión y recuperarla (Priority: P3)

El usuario no tiene que volver a escribir su contraseña cada vez que abre la app. La sesión se
mantiene de forma segura y, si expira, la app le pide entrar de nuevo sin perder los movimientos
registrados sin conexión.

**Why this priority**: mejora mucho la experiencia diaria, pero un inicio de sesión manual es
suficiente para un primer prototipo.

**Independent Test**: se puede probar entrando, cerrando la app y abriéndola días después; el
usuario sigue dentro sin escribir su contraseña.

**Acceptance Scenarios**:

1. **Given** un usuario con sesión iniciada, **When** cierra y vuelve a abrir la app dentro del
   periodo de sesión, **Then** entra directamente sin escribir su contraseña.
2. **Given** un usuario cuya sesión expiró, **When** abre la app, **Then** se le pide iniciar
   sesión y, al hacerlo, los movimientos que había registrado sin conexión se conservan y se
   sincronizan.
3. **Given** un usuario que olvidó su contraseña, **When** solicita recuperarla con su correo,
   **Then** recibe un correo con un enlace para crear una contraseña nueva, y el mensaje en la app
   es el mismo exista o no ese correo en Saveria.
4. **Given** un usuario con un enlace de recuperación válido, **When** crea una contraseña nueva,
   **Then** puede entrar con ella, el enlace deja de servir y todas sus otras sesiones se cierran.
5. **Given** un enlace de recuperación vencido o ya usado, **When** el usuario lo abre, **Then** se
   le indica que no es válido y se le ofrece pedir uno nuevo.

---

### User Story 6 - Verificar el correo (Priority: P2)

Al registrarse, el usuario recibe un correo para confirmar que la dirección es suya. Puede usar la
app de inmediato, pero tiene 7 días para verificar; después, la app le pide verificar antes de
continuar, sin perder sus datos.

**Why this priority**: asegura que la recuperación de contraseña llegue a la persona correcta y
reduce cuentas falsas, pero no debe frenar el primer uso.

**Independent Test**: se puede probar registrando una cuenta, abriendo el enlace del correo y
comprobando que la cuenta queda verificada.

**Acceptance Scenarios**:

1. **Given** un usuario recién registrado, **When** termina el registro, **Then** recibe un correo
   de verificación y puede seguir con el onboarding sin esperar.
2. **Given** un usuario sin verificar, **When** abre el enlace de verificación vigente, **Then** su
   correo queda verificado y la app deja de mostrar el recordatorio.
3. **Given** un usuario sin verificar, **When** pide reenviar el correo, **Then** recibe uno nuevo y
   el enlace anterior deja de servir.
4. **Given** un usuario que no verificó en 7 días, **When** abre la app, **Then** debe verificar su
   correo (o cambiarlo, si lo escribió mal) antes de seguir usándola, y sus datos se conservan.
5. **Given** un usuario que no verificó en 7 días y está sin conexión, **When** abre la app,
   **Then** puede seguir registrando movimientos con normalidad, y el bloqueo aparece cuando la
   app recupera la conexión y el servidor confirma que el correo sigue sin verificar.

---

### Edge Cases

- ¿Qué pasa si el usuario intenta registrarse sin conexión? Se le indica que el registro y el
  primer inicio de sesión necesitan internet; nada se guarda a medias.
- ¿Qué pasa si escribe el correo con mayúsculas o espacios? Se normaliza (minúsculas, sin espacios
  al inicio o al final) antes de registrarlo o compararlo.
- ¿Qué pasa tras muchos intentos fallidos de inicio de sesión? Tras 5 intentos fallidos en 15 minutos
  desde la misma IP hacia el mismo correo, se bloquean los intentos de esa IP a ese correo por 15
  minutos; el dueño puede seguir entrando desde otra red.
- ¿Qué pasa si el país elegido no tiene una moneda sugerida conocida? No se preselecciona ninguna
  y el usuario debe elegirla de la lista.
- ¿Qué pasa si el usuario deja vacío el nombre para la IA? La IA usa el nombre de su correo hasta
  que el usuario elija uno.
- ¿Qué pasa si el usuario borra su cuenta con movimientos pendientes de sincronizar? Esos
  movimientos se descartan junto con la cuenta; la confirmación de borrado lo advierte.
- ¿Qué pasa si una moneda de referencia es igual a la moneda principal? No se permite activarla.
- ¿Qué pasa si alguien pide muchos correos de recuperación o verificación seguidos? Se permiten
  máximo 3 por correo cada hora; los siguientes se rechazan con el mismo mensaje neutral.
- ¿Qué pasa si el usuario escribió mal su correo al registrarse? Puede corregirlo mientras no esté
  verificado; el correo nuevo recibe un enlace nuevo y el anterior deja de servir.
- ¿Qué pasa si el correo de verificación no llega? El usuario puede reenviarlo desde la app.
- ¿Qué pasa si se inicia sesión en un segundo dispositivo? Ambos dispositivos quedan con sesión
  válida y ven los mismos datos tras sincronizar.

## Requirements *(mandatory)*

### Functional Requirements

**Registro e inicio de sesión**

- **FR-001**: El sistema MUST permitir crear una cuenta con correo electrónico y contraseña.
- **FR-002**: El sistema MUST validar que el correo tenga formato válido y que no exista otra
  cuenta activa con ese mismo correo (sin distinguir mayúsculas).
- **FR-003**: El sistema MUST exigir contraseñas de al menos 8 caracteres que incluyan al menos
  una letra y un número.
- **FR-004**: El sistema MUST exigir que el usuario acepte la política de tratamiento de datos
  personales antes de crear la cuenta, y MUST registrar la fecha y la versión de la política
  aceptada.
- **FR-005**: La política de tratamiento de datos MUST informar qué datos se recogen, para qué se
  usan (incluido el uso de país y ciudad), que los relatos se procesan con un proveedor externo de
  IA y cómo ejercer el derecho a borrar los datos.
- **FR-006**: El sistema MUST permitir iniciar sesión con correo y contraseña, y MUST responder con
  un mensaje genérico cuando las credenciales sean incorrectas.
- **FR-007**: El sistema MUST bloquear temporalmente (15 minutos) los intentos de inicio de sesión
  desde una misma IP hacia un mismo correo tras 5 intentos fallidos en 15 minutos. El bloqueo
  MUST NOT afectar los intentos de ese correo desde otras IP, y la respuesta durante el bloqueo
  MUST ser genérica (no revela si el correo existe).
- **FR-008**: El sistema MUST mantener la sesión del usuario entre aperturas de la app durante 30
  días de inactividad como máximo, sin pedir la contraseña de nuevo.
- **FR-009**: Los usuarios MUST poder cerrar sesión; al hacerlo, el dispositivo deja de mostrar sus
  datos y su sesión en ese dispositivo deja de ser válida.
- **FR-010**: El sistema MUST conservar los movimientos registrados sin conexión cuando la sesión
  expira o el usuario cierra sesión, y sincronizarlos cuando el mismo usuario vuelva a iniciar
  sesión. Mientras tanto MUST guardarlos cifrados, separados por usuario y sin mostrarlos a
  ninguna otra sesión del dispositivo. Si al sincronizar la cuenta ya no existe, se descartan.
- **FR-010a**: Al cerrar sesión con movimientos pendientes, el sistema MUST mostrar un aviso
  informativo con la cantidad pendiente (que se enviarán al volver a entrar), sin bloquear el
  cierre de sesión.

**Onboarding**

- **FR-011**: Tras el registro, el sistema MUST guiar al usuario por un onboarding con estos pasos
  en orden: nombre para la IA, país, ciudad, moneda principal y modo de IA.
- **FR-012**: El sistema MUST sugerir la moneda principal según el país elegido (por ejemplo,
  Colombia → COP) y permitir elegir cualquier otra moneda de la lista soportada.
- **FR-013**: El modo de IA MUST venir seleccionado en "manual" por defecto, con una explicación
  breve de los modos manual y automático.
- **FR-014**: El sistema MUST guardar el progreso del onboarding y retomarlo desde el paso
  pendiente si el usuario sale de la app.
- **FR-015**: El sistema MUST impedir registrar movimientos hasta que el usuario haya elegido su
  moneda principal.
- **FR-016**: Al completar el onboarding, el sistema MUST crear automáticamente una cuenta
  "Efectivo" en la moneda principal del usuario, con saldo inicial cero, marcada como cuenta por
  defecto.
- **FR-017**: El nombre para la IA MUST ser opcional, de máximo 30 caracteres; si está vacío, la IA
  usa la parte del correo anterior a la "@".

**Configuración**

- **FR-018**: Los usuarios MUST poder cambiar desde Configuración su nombre para la IA, país,
  ciudad, moneda principal y modo de IA en cualquier momento.
- **FR-018a**: Los usuarios MUST poder cambiar su contraseña desde Configuración ingresando la
  contraseña actual y una nueva que cumpla FR-003. Requiere conexión. Al cambiarla, el sistema
  MUST cerrar todas las demás sesiones del usuario y mantener activa la del dispositivo actual.
- **FR-019**: Al activar el modo automático, el sistema MUST mostrar qué implica y pedir
  confirmación antes de aplicarlo.
- **FR-020**: Los usuarios MUST poder activar hasta 2 monedas de referencia, distintas de su
  moneda principal, que se muestran junto a los montos consolidados.
- **FR-021**: Cambiar la moneda principal MUST cambiar la moneda en que se muestran los totales,
  sin modificar el monto ni la moneda originales de ningún movimiento ni de ninguna cuenta
  existente.
- **FR-022**: Los cambios de configuración hechos sin conexión MUST aplicarse en el dispositivo de
  inmediato y sincronizarse al recuperar la conexión.

**Borrado de cuenta**

- **FR-023**: Los usuarios MUST poder borrar su cuenta desde Configuración, confirmando con su
  contraseña.
- **FR-024**: Al borrar una cuenta, el sistema MUST eliminar de forma definitiva la cuenta, sus
  movimientos, cuentas de dinero, relatos, memoria de conceptos y preferencias, tanto en el
  dispositivo como en el servidor, en un plazo máximo de 30 días para las copias de respaldo.
- **FR-025**: Tras el borrado, las credenciales de esa cuenta MUST dejar de permitir el acceso, y el
  correo MUST quedar libre para un registro nuevo.

**Seguridad y privacidad**

- **FR-026**: El sistema MUST NOT guardar contraseñas en texto plano ni registrar contraseñas,
  tokens de sesión o relatos en los registros de actividad (logs).
- **FR-027**: El sistema MUST garantizar que un usuario solo pueda ver y modificar sus propios
  datos.

**Recuperación de contraseña y verificación de correo**

- **FR-028**: El sistema MUST permitir recuperar el acceso con contraseña olvidada enviando al
  correo de la cuenta un enlace para crear una contraseña nueva.
- **FR-029**: Los enlaces de recuperación MUST vencer a los 30 minutos y servir una sola vez; usar
  uno MUST cerrar todas las demás sesiones del usuario.
- **FR-030**: La respuesta a una solicitud de recuperación MUST ser idéntica exista o no el correo
  en Saveria.
- **FR-031**: Al registrarse, el sistema MUST enviar un correo de verificación; el usuario MUST
  poder usar la app mientras no verifique durante 7 días desde el registro.
- **FR-032**: Pasados 7 días sin verificar, el sistema MUST pedir la verificación antes de permitir
  seguir usando la app, sin borrar ni bloquear la sincronización de los datos ya registrados. El
  bloqueo MUST aplicarse solo cuando hay conexión y el servidor confirma que el correo sigue sin
  verificar; sin conexión, la app MUST seguir funcionando normalmente.
- **FR-033**: Los enlaces de verificación MUST vencer a las 24 horas; pedir uno nuevo MUST
  invalidar el anterior.
- **FR-034**: Los usuarios MUST poder reenviar el correo de verificación y corregir su correo
  mientras no esté verificado.
- **FR-035**: El sistema MUST limitar a 3 por hora los correos de recuperación o de verificación
  enviados a una misma dirección.
- **FR-035a**: El sistema MUST limitar los intentos de crear cuenta a 10 por hora desde una misma
  IP, y los cambios de correo a 5 por hora por usuario. Al pasar el límite MUST responder con un
  mensaje genérico de "demasiados intentos". Así nadie puede usar Saveria para mandar correos a
  direcciones ajenas ni para probar en masa qué correos tienen cuenta.
- **FR-036**: Los correos enviados MUST NOT incluir montos, movimientos ni otros datos financieros.
- **FR-037**: Los enlaces de verificación y de recuperación MUST abrir una página web mínima de
  Saveria donde se completa la acción (confirmar el correo o escribir la contraseña nueva), y
  MUST funcionar desde cualquier navegador, aunque la app no esté instalada en ese dispositivo.
  Al terminar, la página indica que el usuario puede volver a la app. La app MUST reflejar el
  correo verificado la próxima vez que consulte el estado de la cuenta.

### Key Entities *(include if feature involves data)*

- **Usuario**: la persona con cuenta en Saveria. Atributos: correo, contraseña protegida, fecha
  de creación, correo verificado (sí/no y fecha), estado del onboarding, fecha y versión de la política de datos aceptada.
- **Perfil / Preferencias**: configuración del usuario. Atributos: nombre para la IA, país,
  ciudad, moneda principal, monedas de referencia (hasta 2), modo de IA (manual o automático).
  Pertenece a un único usuario.
- **Sesión**: acceso activo de un usuario desde un dispositivo. Atributos: dispositivo, fecha de
  inicio, fecha de último uso, vencimiento. Un usuario puede tener varias sesiones.
- **Cuenta de dinero**: contenedor de saldo (por ejemplo "Efectivo", "Nequi"). En esta
  funcionalidad solo se crea la cuenta "Efectivo" por defecto. Atributos: nombre, moneda, saldo
  inicial, indicador de cuenta por defecto. La gestión completa de cuentas es otra funcionalidad.
- **Enlace de un solo uso**: permiso temporal enviado por correo para verificar la dirección o
  recuperar la contraseña. Atributos: tipo (verificación o recuperación), usuario, vencimiento,
  usado o no. Un enlace nuevo del mismo tipo invalida los anteriores.
- **Moneda soportada**: moneda que el usuario puede elegir. Atributos: código ISO 4217, nombre,
  símbolo, países a los que se sugiere.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona nueva completa el registro y el onboarding en menos de 2 minutos.
- **SC-002**: Al menos el 90% de los usuarios que empiezan el onboarding lo terminan.
- **SC-003**: Un usuario que vuelve a la app dentro del periodo de sesión entra a la pantalla
  principal en menos de 2 segundos, sin escribir su contraseña.
- **SC-004**: El 100% de los usuarios que completan el onboarding tienen una moneda principal y una
  cuenta por defecto, y pueden registrar su primer movimiento de inmediato.
- **SC-005**: Una solicitud de borrado de cuenta elimina los datos activos del usuario en menos de
  24 horas, y el usuario nunca puede volver a entrar con esas credenciales.
- **SC-006**: Ningún registro de actividad contiene contraseñas, tokens de sesión ni relatos (se
  verifica revisando una muestra de logs antes de cada versión).
- **SC-007**: El 95% de los correos de verificación y recuperación llegan en menos de 1 minuto.
- **SC-008**: Un usuario que olvidó su contraseña recupera el acceso en menos de 3 minutos.

## Assumptions

- Si el proveedor de correo no está disponible, el registro igual se completa y el envío se
  reintenta; el usuario puede pedir el reenvío.
- El registro se hace solo con correo y contraseña; iniciar sesión con Google u otros proveedores
  queda fuera del MVP.
- El registro y el primer inicio de sesión requieren conexión a internet; el resto de la app
  funciona sin conexión según la constitución.
- La lista de monedas soportadas en el MVP incluye al menos las monedas de los países de América
  Latina, USD y EUR; la lista exacta se define en el plan técnico.
- La lista de países es fija; la ciudad es texto libre.
- La conversión entre monedas y la descarga de tasas de cambio se especifican en la funcionalidad
  de multimoneda; aquí solo se define qué moneda elige el usuario y cómo se muestran los totales.
- El texto legal definitivo de la política de tratamiento de datos lo redacta el dueño del
  producto; esta funcionalidad solo garantiza que se muestre, se acepte y se registre su versión.
- El historial y la acción de deshacer del modo automático se especifican en la funcionalidad de
  registro por IA; aquí solo se elige el modo.
- La app está disponible solo en Android al inicio y en español.
