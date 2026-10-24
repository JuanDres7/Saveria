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

**Pendiente de medir en una build de release.** En la development build, abrir la app hasta ver
Inicio tardó 9,8 s, 8,6 s y 8,5 s. Ese tiempo lo domina el lanzador de desarrollo, que descarga
desde Metro el bundle sin minificar (1.611 módulos). El código del arranque no espera a la red: abre
la base local y muestra Inicio, y renueva la sesión en segundo plano (pruebas en
`apps/mobile/tests/us5-session.test.tsx`). Para validar los 2 s hay que compilar la variante
release (`bunx expo run:android --variant release`) y repetir la medición.

## Observaciones

- La development build no puede arrancar en modo avión porque descarga su código desde Metro. Se
  probó el arranque sin servidor apagando el backend: la app abrió con los datos locales. La build
  de release trae el código incluido.
- Guardar en Configuración sin cambios también encola un cambio en el outbox. No es un error, pero
  se podría evitar.
- En la página de contraseña nueva, Chrome sugiere un campo de usuario oculto para los gestores de
  contraseñas. Es una mejora opcional.
