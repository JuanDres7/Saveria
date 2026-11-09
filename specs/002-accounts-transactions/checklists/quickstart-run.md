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
