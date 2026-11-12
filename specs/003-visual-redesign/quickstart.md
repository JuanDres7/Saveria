# Quickstart: Rediseño visual de la app

**Fecha**: 2026-11-09 (revisado con «La hoja de Saveria») | **Plan**: [plan.md](plan.md)

Guía para comprobar la feature de punta a punta en el emulador de tu computador, primero en modo claro y después en
modo oscuro. No sustituye a las pruebas automáticas: las complementa con lo que solo se ve. La referencia visual es la
maqueta aprobada: https://claude.ai/artifact/HeGUmjPATU7j8e3wmoWTfc

## Requisitos

- Un emulador Android con la app de desarrollo **reconstruida** para esta feature (trae dibujo vectorial, la letra
  incrustada y la pantalla de arranque nueva) y la API local corriendo.
- `EXPO_PUBLIC_API_URL=http://localhost:8000`, `adb reverse tcp:8081 tcp:8081` y `adb reverse tcp:8000 tcp:8000`.
- Datos de prueba: `EXPO_PUBLIC_SEED_TRANSACTIONS=5000` para las comprobaciones de rendimiento.

## Cambiar de modo y de tamaño de letra sin tocar la app

```bash
adb shell cmd uimode night no                       # claro
adb shell cmd uimode night yes                      # oscuro
adb shell settings put system font_scale 1.5        # letra al 150 %
adb shell settings put system font_scale 1.0        # letra normal
```

## Pruebas automáticas

```bash
cd apps/mobile && bun run test          # todas las de la app, incluidas las visuales en los dos modos
bun run test -- theme-contrast theme-tokens category-icons
cd ../.. && bun run lint && bun run typecheck
```

Esperado: todas en verde; `theme-contrast` falla si algún par baja de 4,5:1 (3:1 en bordes e íconos) y `theme-tokens`
falla si hay un color suelto fuera de `theme/palettes.ts`.

## Recorrido en emulador (en cada modo)

1. **Arranque**: cerrar la app y abrirla. La pantalla de arranque es crema (claro) o verde casi negro (oscuro), sin destello
   blanco ni azul.
2. **Entrar** (US3): bienvenida con la parte superior en forma de hoja → crear cuenta → los 5 pasos del onboarding → iniciar
   sesión → olvidé mi contraseña. Los títulos usan la letra de identidad; campos, errores y botón principal se leen; el teclado
   no tapa el botón.
3. **Inicio** (US1): saludo con tu nombre; tarjeta de balance verde oscuro en forma de hoja (total si todas las cuentas son de
   la moneda principal; si no, «Saldo de {cuenta por defecto}») con «Transferir»; cuentas en una fila que se desliza; últimos
   movimientos sobre una sola lámina, con los gastos en color de texto y signo menos y los ingresos en verde con signo más. En
   una cuenta nueva, el mensaje que invita a tocar el «+».
4. **Registrar** (US2): botón «+» → monto → categoría (chip con ícono) → «Guardar». Cuenta los toques: máximo 3 más el monto y
   menos de 5 s.
5. **Barra inferior** (US4): cambiar entre las cuatro secciones con un toque, la actual marcada; el «+» está en las cuatro y
   abre Registrar; la barra y el «+» no aparecen en formularios, auth ni onboarding. Con una cuenta sin moneda principal, el
   «+» no aparece. «Atrás» desde un formulario vuelve a su sección.
6. **Historial y cuentas** (US5): chips de filtro («Todas» y una por cuenta), lista por día, cuenta archivada, ajustar saldo;
   una cuenta con saldo negativo lo muestra en rojo ladrillo. Desde el detalle de una cuenta se llega a «Registrar movimiento»
   y a «Transferir desde esta cuenta». Los estados vacíos muestran su mensaje.
7. **Ajustes y avisos** (US6): grupos de opciones, cambiar contraseña, borrar cuenta (no confirmar), cerrar sesión, aviso
   «Deshacer» por encima de la barra, aviso de correo sin verificar, error de guardado.
8. **Cambio de modo con la app abierta** (US7): abrir Registrar, escribir un monto, correr
   `adb shell cmd uimode night yes`: la app cambia de aspecto, sigue en la misma pantalla y el monto no se pierde.
9. **Letra al 150 %**: `adb shell settings put system font_scale 1.5`. Ninguna pantalla corta texto ni pierde un botón, y el
   «+» no tapa el nombre de ninguna sección. (SC-005)
10. **Rendimiento** (con 5000 movimientos): registrar un gasto en ≤ 1,5 s y desplazar la lista a ≤ 8 ms / 11 ms por cuadro,
    igual que en la 002.
11. **Pantallas de otro tamaño**: repetir los pasos 3, 4 y 5 con un perfil de pantalla pequeña y otro grande, y con
    navegación por gestos y por tres botones. Nada queda bajo la muesca, la barra de estado ni la barra de gestos, y la
    barra inferior y «Deshacer» no tapan botones.
12. **Sin conexión**: modo avión y repetir el paso 4. Todo funciona igual (principio III).
13. **Nada de más**: no aparece ninguna función del mapa que aún no existe (conversación con Saveria, «Este mes», «Por
    confirmar», «Próximos», metas, deudas). (FR-019)

## Aprobación visual (SC-008)

Después de cada grupo de pantallas, capturas en claro y oscuro junto a la maqueta aprobada y a la imagen de referencia
`inspiracion/Inspiracion.png`; el dueño del proyecto aprueba o pide ajustes antes de seguir.
