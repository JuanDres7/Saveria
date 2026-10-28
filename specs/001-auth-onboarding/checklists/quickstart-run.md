# Recorrido del quickstart: 001-auth-onboarding

**Fecha**: 2026-10-24 | **Rama**: `feat/001-auth-onboarding` | **Tarea**: T104

**Entorno**: emulador `saveria_spike` (Android 16, x86_64), development build conectada a Metro,
backend local (`bun src/main.ts`) con PostgreSQL y Redis en Docker, correos en
`apps/api/.dev-outbox/`. Los enlaces se abrieron en Chrome headless controlado por CDP, revisando
también la consola del navegador. La app se manejó con `adb` (uiautomator, input).

**Pruebas automáticas (T103)**: `bunx biome check .` sin errores; `bun test --cwd apps/api` 318/318;
`bun test --cwd packages/shared` 33/33; `bun run --cwd apps/mobile test` 189/189; `tsc --noEmit`
sin errores en api, mobile y shared.

## Pasos (quickstart §5)

| # | Paso | Resultado | Escenario |
|---|---|---|---|
| 1 | Registrarse sin marcar la política | ✅ No avanza; sigue en "Crea tu cuenta" | 1.2 |
| 2 | Registrarse con ` QS.Run@Mail.com ` y `clave1234` | ✅ Entra al onboarding; el correo de verificación va a `qs.run@mail.com` | 1.1, 6.1 |
| 3 | Onboarding: nombre vacío, Colombia | ✅ COP preseleccionado; modo manual marcado con la explicación de ambos modos; Inicio saluda "Hola, qs.run" | 2.2, 2.3, FR-017 |
| 4 | Cerrar la app (force-stop) en "ciudad" y abrirla | ✅ Vuelve a "¿En qué ciudad vives?" sin pedir la contraseña | 2.5, 5.1 |
| 5 | Terminar el onboarding | ✅ "Efectivo" con 0 COP | 2.4 |
| 6 | Abrir el enlace del correo en el navegador | ✅ El GET muestra el botón (también al recargar); al pulsarlo, "ya puedes volver a la app"; consola sin errores (CSP). Al volver a la app el recordatorio desaparece | 6.2 |
| 7 | 5 logins con contraseña mala | ✅ 5 × `401 invalid_credentials`; el 6.º `429 too_many_attempts` con mensaje genérico | FR-007 |
| 8 | Modo avión → cambiar ciudad → cerrar sesión | ✅ "Guardado en este teléfono"; al cerrar sesión: "Tienes 2 cambios sin sincronizar…" (se guardó dos veces) | 1.7, FR-010a |
| 9 | Quitar el modo avión → entrar con la misma cuenta | ✅ En el servidor la ciudad pasó de "Barranquilla" a "Medellin" | FR-010, FR-022 |
| 10 | Configuración → modo automático | ✅ Explicación ("se guardan sin preguntarte… se pueden deshacer") y casilla de confirmación; el servidor queda en `auto` | 3.1 |
| 11 | Cambiar la contraseña con otra sesión abierta (PC) | ✅ "Listo… cerramos la sesión en tus otros dispositivos"; la sesión del PC pasa de 200 a 401; el teléfono sigue dentro | 3.5 |
| 12 | "Olvidé mi contraseña" con un correo inexistente y con uno existente | ✅ Respuestas idénticas (`202`, mismo mensaje) | 5.3, FR-030 |
| 13 | Abrir el enlace de recuperación dos veces | ✅ El primero cambia la contraseña y cierra todas las sesiones (el teléfono vuelve a la bienvenida); el segundo dice que no es válido y ofrece "Olvidé mi contraseña" | 5.4, 5.5 |
| 14 | Borrar la cuenta con la contraseña | ✅ Bienvenida con "Tu cuenta y todos tus datos fueron borrados."; el login responde 401; registrarse otra vez con el mismo correo empieza el onboarding desde el paso 1 | 4.2, 4.3 |

## Revisión de logs (SC-006)

Se revisaron las 49 líneas que el backend escribió durante el recorrido. No aparecen las
contraseñas usadas (`clave1234`, `nueva5678`, `otra9999`, `mala1234`), el correo, `Bearer`,
`token=`, `refreshToken` ni ningún JWT. La palabra "password" solo aparece en nombres de rutas
(`/v1/auth/password/...`, `/links/reset-password`). La prueba automática
`tests/integration/logs-redaction.test.ts` cubre lo mismo en cada ejecución.

## Arranque con sesión guardada (SC-003)

✅ **Se cumple: Inicio visible en 1,06–1,27 s**, por debajo de los 2 s.

- **Build**: variante release (`./gradlew assembleRelease`, Hermes y minificación activos),
  instalada con `adb install -r` sobre la development build con una sesión guardada de una cuenta
  con el onboarding terminado. Las dos variantes se firman con la misma clave, así que los datos se
  conservan.
- **Condiciones**: emulador `saveria_spike`, **modo avión activado** (sin red) y la app detenida
  con `am force-stop` antes de cada corrida (arranque en frío).
- **Método**: `uiautomator events` registra los eventos de accesibilidad con `EventTime` (uptime en
  ms). Se compara con `/proc/uptime` justo antes de `am start`. Se toma el **último** cambio de
  contenido de la ventana de la app: después no hubo más cambios en 6 s y la pantalla final era
  Inicio ("Hola, qs.run") en todas las corridas. Es una cota superior con resolución de
  milisegundos. Un primer intento consultando la pantalla con `uiautomator dump` no servía: cada
  consulta tarda ~2,3 s.

| Corrida | Ventana de la app | Último cambio (Inicio visible) |
|---|---|---|
| 1 | 63 ms | 1104 ms |
| 2 | 62 ms | 1127 ms |
| 3 | 60 ms | 1107 ms |
| 4 | 66 ms | 1273 ms |
| 5 | 59 ms | 1086 ms |
| 6 | 52 ms | 1060 ms |

La misma prueba confirma el escenario 5.1 sin conexión: la build de release abre directo en Inicio
en modo avión. En la development build, en cambio, el arranque tarda ~8,5 s porque el lanzador de
desarrollo descarga el bundle sin minificar desde Metro; no sirve para medir SC-003.

## Observaciones

- La development build no puede arrancar en modo avión porque descarga su código desde Metro. La
  build de release trae el código incluido y sí arranca sin red (ver SC-003).
- La build de release no permite HTTP sin cifrar (solo los manifiestos de debug tienen
  `usesCleartextTraffic`), así que no puede hablar con el backend local en `http://10.0.2.2:8000`.
  Es lo correcto para producción, donde la API irá por HTTPS.
- El emulador se arranca con `-no-snapshot-save`: cada arranque vuelve al último snapshot y se
  pierden los datos de la sesión anterior. Para pruebas que dependan de datos guardados hay que
  hacerlas en un mismo arranque del emulador.
- Guardar en Configuración sin cambios también encola un cambio en el outbox. No es un error, pero
  se podría evitar.
- En la página de contraseña nueva, Chrome sugiere un campo de usuario oculto para los gestores de
  contraseñas. Es una mejora opcional.
