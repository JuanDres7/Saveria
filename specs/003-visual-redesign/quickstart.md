# Quickstart: Rediseño visual de la app

**Fecha**: 2026-11-09 | **Plan**: [plan.md](plan.md)

Guía para comprobar la feature de punta a punta en el emulador de tu computador, primero en modo claro y después en
modo oscuro. No sustituye a las pruebas automáticas: las complementa con lo que solo se ve.

## Requisitos

- Un emulador Android con la app de desarrollo instalada (la de la 002) y la API local corriendo.
- `EXPO_PUBLIC_API_URL=http://localhost:8000`, `adb reverse tcp:8081 tcp:8081` y `adb reverse tcp:8000 tcp:8000`.
- Datos de prueba: `EXPO_PUBLIC_SEED_TRANSACTIONS=5000` para las comprobaciones de rendimiento.

## Cambiar de modo sin tocar la app

```bash
adb shell cmd uimode night no    # claro
adb shell cmd uimode night yes   # oscuro
```

## Pruebas automáticas

```bash
cd apps/mobile && bun run test          # todas las de la app, incluidas las visuales en los dos modos
bun run test -- theme-contrast theme-tokens category-icons
cd ../.. && bun run lint && bun run typecheck
```

Esperado: todas en verde; `theme-contrast` falla si algún par baja de 4,5:1 (3:1 en bordes) y `theme-tokens` falla si
hay un color suelto fuera de `theme/palettes.ts`.

## Recorrido en emulador (en cada modo)

1. **Arranque**: cerrar la app y abrirla. La pantalla de arranque es crema (claro) o verde casi negro (oscuro), sin destello
   blanco ni azul. (SC-001, caso límite de arranque)
2. **Entrar** (US3): bienvenida → crear cuenta → los 5 pasos del onboarding → iniciar sesión → olvidé mi contraseña. Los campos,
   errores y botón principal ancho se ven y se leen; el teclado no tapa el botón.
3. **Inicio** (US1): saludo con tu nombre, tarjeta de balance (total si todas las cuentas son de la moneda principal; si no, la
   cuenta por defecto con su nombre), cuentas debajo, últimos movimientos con ícono, y el estado vacío amable en una cuenta nueva.
4. **Registrar** (US2): «Registrar movimiento» → monto → categoría con ícono → guardar. Cuenta los toques: máximo 3 más el monto.
5. **Barra inferior** (US4): cambiar entre las cuatro secciones con un toque, la actual marcada; no aparece en formularios, auth ni
   onboarding. Desde Inicio y desde una cuenta se llega a Registrar y a Transferir.
6. **Historial y cuentas** (US5): chips de filtro, lista por día con montos con signo, cuenta archivada, ajustar saldo.
7. **Ajustes y avisos** (US6): cambiar contraseña, borrar cuenta (no confirmar), aviso «Deshacer», aviso de correo sin verificar,
   error de guardado.
8. **Cambio de modo con la app abierta** (US7): abrir «Registrar movimiento», escribir un monto, correr
   `adb shell cmd uimode night yes`: la app cambia de aspecto, sigue en la misma pantalla y el monto no se pierde.
9. **Letra grande**: Ajustes del teléfono → Tamaño de fuente al máximo. Ninguna pantalla corta texto ni tapa un botón. (SC-005)
10. **Rendimiento** (con 5000 movimientos): registrar un gasto ≤ 1,5 s y desplazar la lista sin trabarse (≤ 8 ms / 11 ms por cuadro),
    igual que en la 002.
11. **Pantallas de otro tamaño**: repetir los pasos 3, 4 y 5 con un perfil de pantalla pequeña y otro grande, y con
    navegación por gestos y por tres botones. Nada queda bajo la muesca, la barra de estado ni la barra de gestos, y la
    barra inferior y «Deshacer» no tapan botones.
12. **Sin conexión**: modo avión y repetir el paso 4. Todo funciona igual (principio III).

## Aprobación visual (SC-008)

Después de cada grupo de pantallas, capturas en claro y oscuro junto a la imagen de referencia
`inspiracion/Inspiracion.png`; el dueño del proyecto aprueba o pide ajustes antes de seguir.
