# Revisión visual de la 003

Registro de lo que se revisa en el emulador (`saveria_spike`, 1080×2400, 420 dpi) en modo claro y oscuro, y de la aprobación del
dueño del proyecto por grupo de pantallas (SC-008). Las capturas se guardan fuera del repositorio.

## Base del tema (T024), 2026-11-10

Se reconstruyó la app de desarrollo (`expo prebuild` + Gradle `assembleDebug`, solo x86_64, 3 min 34 s) porque cambian cosas
nativas: `react-native-svg`, la letra incrustada y la pantalla de arranque.

| Comprobación | Resultado |
|---|---|
| La compilación recoge la letra | `MainApplication.kt` registra la familia `BricolageGrotesque` (pesos 600 y 700) con el plugin de `expo-font`. Sin carga en ejecución. |
| Título en la letra de identidad | La bienvenida muestra «Bienvenido a Saveria» en Bricolage Grotesque Bold, y el texto corrido en la letra del sistema. |
| Arranque en frío, modo claro | Tres capturas a 0,4 s, 0,8 s y 1,2 s del arranque: todas en crema `#F6F3EA`. Sin destello blanco ni azul. |
| Arranque en frío, modo oscuro | Las mismas tres capturas: todas en `#14180F`. Sin destello blanco. |
| Cambio de modo con la app abierta | `adb shell cmd uimode night yes` cambia el fondo y la barra de estado al instante, sin cerrar la app. |
| Forma de fondo | La forma orgánica `sage` aparece arriba a la derecha en los dos modos y no tapa texto. |
| Cifras tabulares de la letra | **Pendiente**: la bienvenida no tiene cifras. Se comprueba en Inicio (T032) con la cifra del balance. |

### Lo que se ve «a medias» a propósito

La bienvenida todavía no se migra (es la tarea T039 de la historia 3). Por eso, en modo oscuro, el texto corrido y «Ya tengo cuenta»
aparecen casi invisibles: esas dos piezas aún usan colores fijos de antes del rediseño. Pasa en todas las pantallas sin migrar y
desaparece al migrarlas en su historia.

El engranaje redondo arriba a la derecha es el botón «Tools» de la app de desarrollo de Expo, no forma parte de Saveria.

## Inicio (historia 1, T032), 2026-11-10

Cuenta `qs002.final@mail.com` en el emulador, con la API local y 14 movimientos de ejemplo sembrados (`EXPO_PUBLIC_SEED_TRANSACTIONS=14`).

| Comprobación | Resultado |
|---|---|
| Saludo en la letra de identidad | «Hola, qs002.final» y los títulos de sección en Bricolage Grotesque; el resto del texto, en la del sistema. |
| Tarjeta de balance | Verde oscuro con forma de hoja (esquinas 34 y 12) y nervaduras; «$ 80.000 COP» (luego «$ 69.929 COP» con los movimientos); «En 1 cuenta». En modo oscuro pasa a `#2C3720` y se lee igual. |
| Cifra grande | Se ve nítida y sin saltos; el monto de las listas, en la letra del sistema con cifras tabulares (alinean). La cifra del balance queda en la letra de identidad. |
| Cuentas | Fila horizontal con una cuenta; ícono del tipo, nombre y saldo. |
| Movimientos | Fila simple con círculo de categoría (arena para «Restaurantes y domicilios», verde base para el «Salario»), título, cuenta y descripción. Gastos con «−» en el color del texto; ingreso en verde con «+». |
| Aviso de correo sin verificar | Ahora sigue el tema; en modo oscuro tiene el fondo y el texto oscuros del aviso (antes quedaba en claro). El resto de su restyle es de la historia 6. |
| Estado vacío | Cuenta nueva: «Aún no tienes movimientos. Registra el primero con «Registrar movimiento».» (provisional hasta que exista el «+»). |
| Pruebas | 435 de la app en verde, `tsc` y lint sin errores. |

Aprobado por el dueño del proyecto el 2026-11-10 (SC-008) con las capturas de claro y oscuro.

## Registrar, editar y transferir (historia 2, T037), 2026-11-10

Emulador con la API local y la cuenta `qs002.final@mail.com` (dos cuentas: Nequi y Efectivo).

| Comprobación | Resultado |
|---|---|
| Encabezado | Círculo «Volver» y título en la letra de identidad, en Registrar, Editar y Transferir; «atrás» del sistema también vuelve. |
| Selector Gasto / Ingreso | Una sola píldora con la opción elegida en verde de acción (oliva claro con texto oscuro en modo oscuro). |
| Monto | Grande y centrado en la letra de identidad, con «Monto en COP» debajo; el ejemplo `18.000` va en un tono claro para no confundirse con lo escrito; el cursor es del verde de acción. |
| Categorías | Dieciocho chips con su ícono de línea, el elegido relleno; con el teclado abierto, tocar una categoría lo cierra. |
| «Guardar» a la vista | Fijo en el pie. Se descubrió que, con el borde a borde de Android, el teclado lo tapaba mientras se escribía el monto: el pie ahora sube con el teclado (`KeyboardAvoidingView`) y se ve «Guardar» encima de él. |
| Flujo típico | Monto `18000` + categoría + «Guardar»: 2 toques más el monto. El movimiento aparece en Inicio y el total se actualiza antes de 1,5 s (medida a ojo con un volcado a los 1,5 s, no con el método fino de la 002). |
| Editar y borrar | «Editar movimiento» con los datos cargados y «Guardar cambios» + «Borrar» en el pie; borrar muestra «Movimiento borrado · Deshacer». |
| Transferir | Chips «Desde» y «Hacia» (el origen no aparece en «Hacia»), monto grande y fecha, mismos elementos que Registrar. |
| Modo oscuro | Revisado en los tres formularios; todo se lee. |
| Pruebas | 451 pruebas de la app en verde, `tsc` y lint sin errores. |

Aprobado por el dueño del proyecto el 2026-11-10 (SC-008) con las capturas de Registrar, Editar y Transferir.

## Entrar y empezar (historia 3, T042), 2026-11-10

Recorrido en el emulador sin sesión: bienvenida → crear cuenta → los cinco pasos del onboarding → Inicio, y después cerrar sesión → iniciar sesión → «olvidé mi contraseña». Cuenta nueva creada con la API local.

| Comprobación | Resultado |
|---|---|
| Bienvenida | Parte superior verde oscuro con la forma de la marca (esquina inferior derecha muy redonda) y las nervaduras de la hoja; la marca «Saveria» con su ícono en la letra de identidad; mensaje breve; «Crear cuenta» ancho y «Ya tengo cuenta» como vínculo de 48 dp. |
| Crear cuenta | «Volver» redondo arriba, campos con borde suave, ayuda en gris verdoso y la casilla de la política con una marca de verificación al elegirla (no solo color). |
| Onboarding | «Paso N de 5» y una barra de cinco tramos que se llena paso a paso; una sola acción principal por pantalla; las opciones elegidas llevan borde, fondo y una marca. |
| Iniciar sesión y recuperar contraseña | Mismos campos y botones, con «Volver» y vínculos de al menos 48 dp. En modo oscuro todo se lee: el texto corrido ya no sale negro. |
| Flujo completo | Cuenta creada, los cinco pasos y llegada a Inicio con «Total: $ 0 COP» y el aviso de correo sin verificar con los colores del tema. |
| Lint | `biome.json` ahora permite el componente `Body` como texto corrido en `apps/mobile` (regla `noReactNativeRawText`), solo para esa carpeta. |
| Pruebas | 476 pruebas de la app en verde, `tsc` y lint sin errores. |

Aprobado por el dueño del proyecto el 2026-11-10 (SC-008) con las capturas de la bienvenida, crear cuenta, onboarding e iniciar sesión.

## Barra inferior (historia 4, T048), 2026-11-10

Emulador con la API local, la cuenta `qs002.final@mail.com` (dos cuentas, movimientos de ejemplo).

| Comprobación | Resultado |
|---|---|
| Barra | Cuatro secciones con ícono y nombre, la actual con píldora salvia y nombre en negrita; el «+» al centro con la forma de hoja y su sombra, sobresaliendo de la barra. En oscuro, píldora y «+» en oliva claro. |
| Navegación | Tocar Movimientos, Cuentas y Ajustes abre cada sección; el «+» abre «Registrar movimiento» desde todas. En Registrar no hay barra y «Guardar» sigue a la vista. |
| «Atrás» | Desde Registrar vuelve a la sección anterior (el primer «atrás» cierra el teclado que abre el monto); desde Ajustes vuelve a Cuentas. Dos «atrás» seguidos desde Inicio siguen saliendo de la app. |
| Aviso «Deshacer» | Al borrar un movimiento aparece sobre la barra y sin tapar el «+»; se rehízo con los colores del tema (antes la acción casi no se veía). |
| Ajustes | Ya no tiene «Volver» y trae «Cerrar sesión». El detalle de una cuenta tiene «Registrar movimiento». |
| Pantalla pequeña y botones | Con 720×1280 y navegación de tres botones, la barra queda encima de los botones del sistema y nada se tapa. |
| Letra al 150 % | El nombre «Movimientos» se partía a media palabra («Movimie-ntos»); ahora se achica para caber en una línea. |
| Fondo de las pantallas | La pila de la app ahora pinta el fondo del tema, así que no se ve gris claro entre pantallas en modo oscuro. |
| Pruebas | 505 pruebas de la app en verde, `tsc` y lint sin errores. |

Pantallas sin migrar todavía (Historial, Cuentas, Ajustes): en modo oscuro su texto sigue negro hasta sus historias (5 y 6).

Aprobado por el dueño del proyecto el 2026-11-10 (SC-008) con las capturas de la barra, el aviso «Deshacer», la pantalla pequeña y la letra al 150 %.

## Historial y cuentas (historia 5, T053), 2026-11-10

Emulador con la API local y la cuenta `qs002.final@mail.com` con 5000 movimientos sembrados (`EXPO_PUBLIC_SEED_TRANSACTIONS=5000`, 57 s en sembrarse, solo desarrollo).

| Comprobación | Resultado |
|---|---|
| Historial | Título en la letra de identidad, filtros «Todas / Nequi / Efectivo» como chips y «Mostrando N movimientos»; la lista va sobre la lámina clara con filas simples, círculo de categoría y monto con signo. |
| Cuentas | Tarjetas suaves con el ícono del tipo, nombre, «Cuenta por defecto» en texto y el saldo en su moneda (negativo en rojo con signo). «Nueva cuenta» ancho y «Cuentas archivadas» como vínculo. |
| Detalle, nueva, archivadas y ajustar | Con «Volver», título, campos y chips de la misma familia que los formularios de Registrar; el aviso de moneda bloqueada lleva ícono y texto. |
| Rechazos del servidor | Se ven con ícono y su motivo en la fila (movimiento o cuenta). |
| Consultas con 5000 movimientos | Saldos de 2 cuentas en **4 ms** y primera página (50) en **5 ms**; en la 002 fueron 8 ms y 11 ms. |
| Paginación | Al desplazar el historial carga de 50 en 50 (se llegó a «Mostrando 200 movimientos»). |
| Fluidez al desplazar | Informativa: con 14 deslizamientos seguidos en el emulador (dibujo por software), `gfxinfo` dio 543 cuadros, 7,7 % lentos, percentil 50 de 30 ms y 90 de 42 ms. La 002 no midió cuadros, solo consultas, así que no hay punto de comparación; en un teléfono real el dibujo es mucho más rápido. |
| Pruebas | 528 pruebas de la app en verde, `tsc` y lint sin errores. |

Aprobado por el dueño del proyecto el 2026-11-10 (SC-008) con las capturas del historial, las cuentas, el detalle y la nueva cuenta.

## Claro y oscuro de punta a punta (historia 7, T056), 2026-11-10

| Comprobación | Resultado |
|---|---|
| Colores solo del tema | `us7-modes.test.tsx` recorre 20 pantallas (bienvenida, acceso, 5 pasos, Inicio, Registrar, Editar, Transferir, Historial, Cuentas, nueva, archivadas, detalle, ajustar y la barra) y el aviso «Deshacer», en claro y en oscuro: todos los colores que dibujan salen de la paleta del modo (ningún color suelto). |
| Cambio de modo con un formulario a medias | En el emulador, con «Registrar movimiento» abierto, monto `25000`, «Transporte» y la cuenta Nequi elegidos, `adb shell cmd uimode night yes` cambió todo a oscuro al instante sin salir de la pantalla ni perder nada. En pruebas, lo mismo con Crear cuenta (correo y casilla). |
| Arranque en frío en oscuro | Sin destello blanco ni azul (verificado en la base del tema, T024). |
| Letra al 150 % | Inicio, Registrar, Historial y Cuentas se ven completas: nombres largos de categoría pasan a otra línea, la barra achica sus nombres y los saldos de las cuentas se achican en vez de cortarse con «…» (se encontró y se corrigió en este recorrido). |
| Gasto, ingreso y saldo negativo | Gasto en el color del texto con «−», ingreso en verde con «+» y saldo negativo en rojo, en los dos modos. |
| Pruebas | 578 pruebas de la app en verde, `tsc` y lint sin errores. |

Quedan para la historia 6 Configuración, cambiar contraseña, borrar cuenta, el bloqueo de verificación y los demás avisos.

Aprobado por el dueño del proyecto el 2026-11-10 (SC-008) con las capturas del cambio de modo y de la letra al 150 %.

## Configuración y avisos (historia 6, T060), 2026-11-11

Emulador con la API local y la cuenta `qs002.final@mail.com` (correo sin verificar), en claro y en oscuro.

| Comprobación | Resultado |
|---|---|
| Configuración | Título en la letra de identidad y tres tarjetas con ícono: «Saveria», «País y moneda» y «Tu cuenta». Cada opción conserva su nombre; «Guardar cambios» ancho en verde y «Cerrar sesión» dentro de «Tu cuenta». Sin «Volver» (es una pestaña). |
| Cambiar contraseña | «Volver» redondo, campos y regla de la clave en texto suave; el botón sigue apagado hasta llenar los campos. |
| Borrar mi cuenta | Sigue siendo inequívoco: texto normal, «Esta acción no se puede deshacer.» en rojo con ícono de alerta, contraseña obligatoria y botón apagado sin ella. Sin tono motivador. No se confirmó el borrado. |
| Aviso de correo sin verificar (Inicio) | Tarjeta ámbar suave con título, fecha límite y los dos vínculos «Reenviar correo» y «Corregir mi correo»; legible en oscuro. |
| «Movimiento borrado · Deshacer» | Barra clara sobre fondo oscuro, «Deshacer» subrayado y de 48 px de alto; queda por encima de la barra inferior y del «+». Dura los mismos 6 s. |
| Error de monto en el formulario | «Escribe un monto» con ícono y en rojo suave, subrayado del campo en rojo; legible en oscuro. |
| Bloqueo de verificación | Cubierto por pruebas (`us6-settings-visual.test.tsx`): mismo texto, mismos botones y «Cerrar sesión» funcionando con el estilo nuevo. |
| Pruebas | 591 pruebas de la app en verde, `tsc` y lint sin errores. |

Aprobado por el dueño del proyecto el 2026-11-11 (SC-008) con las capturas de Configuración, borrar cuenta, el aviso de correo y «Deshacer».

## Ajuste a la maqueta (después de integrar la 003), 2026-11-12

Se comparó la app con la maqueta aprobada «La hoja de Saveria» pantalla por pantalla y se corrigieron 12 diferencias. Quedan igual, por decisión del dueño del proyecto, el título de cada movimiento (la categoría) y el «COP» en el saldo de las cuentas. Rama `fix/003-match-mockup`.

| # | Dónde | Cambio |
|---|---|---|
| 1 | Todas | Título de pantalla de 26 a 30 y cifra del balance de 34 a 44 (se achica sola si el monto no cabe): la maqueta se dibujó en un teléfono angosto y en uno real se veían pequeños |
| 2 | Bienvenida | La hoja verde ocupa cerca de la mitad de la pantalla (deja siempre sitio al texto y a los botones) y su curva mide el 55 % del ancho; nervaduras más grandes y pegadas abajo |
| 3 | Inicio | Marca de hoja a la derecha del saludo (adorno, no se lee) |
| 4 | Inicio | «Ver todas» junto a «Tus cuentas» (abre Cuentas) y «Ver todo» junto a «Últimos movimientos» |
| 5 | Movimientos | Título «Movimientos» (antes «Historial») y el conteo justo debajo, antes de los filtros |
| 6 | Registrar, editar, transferir | Monto con el símbolo de la moneda delante y sin línea; el error se lee en su mensaje con ícono |
| 7 | Cuentas | Título «Cuentas», una sola lámina con las cuentas en filas, «Nueva» como vínculo arriba (nombre accesible «Nueva cuenta») y «Cuentas archivadas» al final |
| 8 | Montos | Signo menos tipográfico («−$ 18.000») en listas, saldos y diferencias |
| 9 | Movimientos | Filtros en una sola fila que se desliza |
| 10 | Formularios y bienvenida | Sin la forma de fondo de la esquina |
| 11 | Bienvenida | «Ya tengo cuenta» en negrita y sin subrayar |
| 12 | Barra | Ícono de lista en Movimientos y de controles en Ajustes |

Verificado en el emulador en claro y en oscuro (Inicio, Movimientos, Cuentas, Registrar con un monto escrito y Bienvenida) y con la letra al 150 % en Inicio.

Pruebas que cambiaron a propósito: las que esperaban «-$» ahora esperan «−$» (`us1-home-visual`, `us1-record`, `us2-history`, `us5-lists-visual`, `us5-transfer`, `us6-adjust`, `us7-modes`); `us5-lists-visual` espera los títulos «Movimientos» y «Cuentas» y ya no un botón ancho de «Nueva cuenta»; `us2-record-visual` comprueba el mensaje de error del monto en vez del color de la línea; `us7-modes` comprueba la lámina de Cuentas en vez del fondo de cada tarjeta. Pruebas nuevas en `us8-mockup-match.test.tsx` (una por cada punto). Total de la app: 610 en verde, `tsc` y lint sin errores; `packages/shared` 118 (se exportó `currencySymbol`).

Pendiente de aprobación del dueño del proyecto (SC-008).

