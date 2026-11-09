# Recorrido manual: 002-accounts-transactions

Se va llenando al cerrar cada historia. El recorrido completo del quickstart (pasos 1–15) es la
tarea T066.

## Historia 1: registrar un gasto o un ingreso (2026-11-08)

**Entorno**: emulador `saveria_spike` (Android 16) con la development build de la 001 (sin
reinstalar: no hay código nativo nuevo), Metro con `EXPO_PUBLIC_API_URL=http://localhost:8000`,
backend local (`bun src/main.ts`) con PostgreSQL y Redis en Docker, `adb reverse` de 8081 y 8000.
Cuenta de prueba `qs002.us1@mail.com` creada por la API con el onboarding terminado en COP. La app
se manejó con `adb` (uiautomator, input). El emulador está en hora UTC, por eso los movimientos
quedan con fecha 2026-11-09.

| Escenario | Paso | Resultado |
|---|---|---|
| — | Entrar con una cuenta de la 001 | ✅ La base local se actualiza sola; Inicio muestra "Efectivo · $ 0 COP" |
| 1.1 | Abrir "Registrar movimiento" | ✅ "Gasto", "Efectivo" y "Hoy" marcados |
| 1.2 / SC-001 | Escribir `18.000`, tocar "Restaurantes y domicilios", "Guardar" | ❌ → ✅ La primera vez el teclado numérico tapaba "Guardar" (había que cerrarlo: más de 3 toques). **Corregido**: al tocar una categoría se cierra el teclado y "Guardar" queda fijo abajo. Después: Inicio muestra el gasto y "-$ 18.000 COP"; llegó al servidor (`expense 18000 dining`) |
| 1.4 | Modo avión → ingreso de `50.000` en "Salario" | ✅ Aparece en Inicio y el saldo pasa a "$ 32.000 COP"; el servidor no lo tiene. Al quitar el modo avión llega solo (`income 50000 salary`) |
| 1.5 | "Guardar" sin nada | ✅ "Escribe un monto" y "Elige una categoría" |
| 1.6 | `18000,50` en COP | ✅ "Los montos en COP van sin decimales" |
| FR-037 | Rechazo del servidor | Cubierto por la prueba automática `apps/mobile/tests/us1-record.test.tsx` |

## Historia 2: ver el historial y el saldo (2026-11-08)

Mismo entorno. El emulador arranca sin datos guardados (`-no-snapshot-save`) y la 002 no descarga
del servidor lo registrado en otro dispositivo (feature 006), así que se empezó con "Efectivo" en
$ 0 y se crearon tres movimientos desde la app.

**Nota del entorno**: la primera vez que se abre la development build por enlace justo después de
arrancar el emulador, Android la cierra con "App react context shouldn't be created before". Es
de la development build, no de Saveria: cerrar la app (`am force-stop`) y abrirla de nuevo lo
resuelve.

| Escenario | Paso | Resultado |
|---|---|---|
| 2.1 | Ingreso de 50.000 (hoy), gasto de 18.000 (hoy), gasto de 3.700 (ayer) | ✅ Tarjeta "Efectivo · $ 28.300 COP" y "Total: $ 28.300 COP" |
| 2.2 | Inicio y "Ver todo" | ✅ Agrupados en "Hoy" y "Ayer", del más reciente al más antiguo; gastos en rojo con "-", ingresos en verde |
| 2.3 | Filtro por cuenta | ✅ Chips "Todas" y "Efectivo"; con transferencias se prueba en la historia 5 |
| 2.6 | Modo avión → cerrar y abrir la app | ✅ Inicio muestra los saldos y los movimientos guardados en el teléfono |
| 2.4, 2.5, FR-014 | Varias monedas, archivadas, saldo negativo | Cubiertos por `apps/mobile/tests/us2-history.test.tsx`; se repiten en el emulador al tener cuentas (historia 3) |

## Historia 3: gestionar cuentas (2026-11-08)

Mismo entorno y misma cuenta de prueba. Se comprobó también que el servidor quedara igual que el
teléfono (consulta a `accounts` en la base de desarrollo).

| Escenario | Paso | Resultado |
|---|---|---|
| 3.1 / 3.2 | "Cuentas de dinero" → "Nueva cuenta": "Nequi", billetera digital | ✅ COP preseleccionada; la cuenta aparece en la lista. Al editarla con saldo inicial `80.000` muestra "$ 80.000 COP" |
| 3.3 | "Usar como cuenta por defecto" en Nequi | ✅ La lista la marca como "Cuenta por defecto" y "Registrar movimiento" la trae elegida |
| 2.5 | Gasto de 30.000 en Nequi | ✅ Inicio muestra las dos tarjetas y "Total: $ 50.000 COP" |
| 3.8 | Detalle de Nequi (con movimientos) | ✅ "No puedes cambiar la moneda de una cuenta que ya tiene movimientos"; no se ofrecen otras monedas |
| 3.7 | "Archivar" en Nequi (cuenta por defecto) | ✅ "No puedes archivar la cuenta por defecto. Elige otra cuenta por defecto antes" |
| 3.6 | "Archivar" en Efectivo | ✅ Aviso "Esta cuenta tiene $ 0 COP…"; al confirmar sale de la lista y aparece en "Cuentas archivadas" |
| FR-021 | Crear otra "efectivo" y reactivar la archivada | ✅ Pide cambiarle el nombre; renombrada "Efectivo viejo" se reactiva |
| 3.5 | Crear "nequi" | ✅ "Ya tienes una cuenta activa con ese nombre" |
| — | Servidor | ✅ `Efectivo viejo` (activa, no por defecto), `Nequi` (por defecto, 80.000), `efectivo` |
| 3.9, FR-037 | Sin red y rechazo del servidor | Cubiertos por `apps/mobile/tests/us3-accounts.test.tsx` |

## Historia 4: editar y borrar un movimiento (2026-11-09)

Mismo entorno y misma cuenta de prueba. Se creó "Restaurantes y domicilios" de 18.000 y
"Transporte" de 3.700 desde la app (saldo de Nequi, la cuenta por defecto: $ 58.300) y se
comprobó cada cambio también en el servidor.

| Escenario | Paso | Resultado |
|---|---|---|
| 4.1 | Tocar el gasto de restaurantes → monto `20.000` → "Guardar cambios" | ✅ El saldo baja otros 2.000 ($ 56.300); en el servidor `dining 20000` |
| 4.4 | Tocar el gasto de transporte → "Borrar" | ✅ Desaparece al instante, el saldo sube a $ 60.000 y aparece "Movimiento borrado · Deshacer"; en el servidor queda con `deleted_at` |
| 4.4 | Esperar sin tocar "Deshacer" | ✅ El aviso desaparece solo (a los 6 s) y el borrado se mantiene |
| 4.5 | Borrar el gasto de restaurantes y tocar "Deshacer" enseguida | ✅ Vuelve el movimiento y el saldo; en el servidor sigue vivo |
| 4.6 | Modo avión: crear "Mercado" de 5.000, editarlo a 9.000 y borrarlo; quitar el modo avión | ✅ El servidor recibió un solo `DELETE` (204) y no creó ningún movimiento de 5.000 ni de 9.000 |
| 4.2, 4.3, FR-037 | Cambiar cuenta o fecha, cambiar a otra moneda, borrado rechazado, cuenta archivada en el selector | Cubiertos por `apps/mobile/tests/us4-edit-delete.test.tsx` |

**Nota**: cada lectura de pantalla con `uiautomator` tarda unos 2 s; al probar "Deshacer" hay que
tocarlo enseguida o el aviso (6 s) ya se fue.

## Historia 5: transferir entre cuentas (2026-11-09)

Cuenta de prueba nueva `qs002.us5@mail.com` / `clave1234` (creada por la API, "Efectivo" en COP).
En la app se crearon "Nequi" (COP) y "Ahorros USD" (USD) y se registró un ingreso de 500.000 en
Efectivo. Cada paso se comprobó también en el servidor.

| Escenario | Paso | Resultado |
|---|---|---|
| — | Inicio con una sola cuenta de dinero | ✅ No aparece "Transferir"; con tres cuentas sí |
| 5.2 / 5.4 | Abrir "Transferir" | ✅ "Desde: Efectivo" elegido; "Hacia" ofrece solo Nequi y Ahorros USD (nunca la de origen); no hay categoría |
| 5.1 | Efectivo → Nequi, `100.000` | ✅ Efectivo $ 400.000, Nequi $ 100.000; en el servidor **una sola fila** `transfer 100000 COP → 100000 COP`, sin categoría; en Inicio aparece una vez como "Efectivo → Nequi" |
| 5.3 | Efectivo → Ahorros USD | ✅ Pide "Monto que sale (COP)" y "Monto que entra (USD)" y avisa "Cada cuenta usa su moneda: no se calcula ninguna tasa"; `40.000` COP → `10` USD: Efectivo $ 360.000, USD 10,00; servidor `40000 COP → 10 USD` |
| 5.5 | Editar la primera transferencia a `150.000` | ✅ Los dos saldos cambian juntos: Efectivo $ 310.000, Nequi $ 150.000 |
| 5.5 | Borrarla | ✅ Los dos saldos vuelven a la vez: Efectivo $ 460.000, Nequi $ 0; en el servidor la fila queda con `deleted_at` |
| 2.3 | Filtro por cuenta con transferencias | Cubierto por `apps/mobile/tests/us5-transfer.test.tsx` (aparece una sola vez en "Todas", con "-" en el origen y "+" en el destino) |
| 5.4 (misma cuenta), FR-030 sin red | Reglas del servicio y cola | Cubiertos por las pruebas automáticas (servicio, servidor y outbox) |

## Historia 6: ajustar el saldo (2026-11-09)

Cuenta de prueba `qs002.us5@mail.com`. Se registró un ingreso de 120.000 en Efectivo para partir de
un saldo conocido y cada paso se comprobó también en el servidor.

| Escenario | Paso | Resultado |
|---|---|---|
| 6.1 | Cuentas de dinero → Efectivo → "Ajustar saldo" → saldo real `115.000` | ✅ Muestra "Saldo actual: $ 120.000 COP" y "Diferencia: -$ 5.000"; al confirmar el saldo queda en $ 115.000 y el servidor tiene `adjustment -5000` sin categoría |
| 6.3 | Volver a "Ajustar saldo" con saldo real `115.000` (igual al actual) | ✅ "El saldo ya coincide: no se crea ningún ajuste"; el botón queda deshabilitado (comprobado en la prueba automática) |
| 6.2 | Inicio | ✅ El movimiento aparece como "Ajuste de saldo", sin categoría |
| 6.4 | Tocar el ajuste → "Borrar" | ✅ Dice "Los ajustes no se editan: bórralo y haz uno nuevo."; al borrar el saldo vuelve a $ 120.000; en el servidor el ajuste queda con `deleted_at` |
