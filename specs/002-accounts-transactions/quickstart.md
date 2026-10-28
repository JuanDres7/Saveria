# Quickstart: validar la feature 002-accounts-transactions

Guía para comprobar de punta a punta que la feature cumple la spec. El contrato está en
[contracts/openapi.yaml](contracts/openapi.yaml) y el modelo en [data-model.md](data-model.md).
Los prerrequisitos y el arranque del backend son los de
[la 001](../001-auth-onboarding/quickstart.md) (§1 y §2), más la migración nueva:

```powershell
docker compose up -d postgres redis
bun run --cwd apps/api db:migrate          # agrega accounts.type/archived_at y transactions
bun run --cwd apps/api dev                 # http://localhost:8000
```

## 1. Pruebas automáticas

```powershell
bun test --cwd apps/api            # unitarias + contrato + integración (requiere compose arriba)
bun test --cwd packages/shared     # catálogo de categorías, dinero exacto, validaciones
bun run --cwd apps/mobile test     # jest-expo
bunx biome check .
```

Esperado: todo en verde. Las pruebas de contrato validan las respuestas contra el contrato de
la 002, que incluye el de la 001.

## 2. App en el celular (por cable USB)

Igual que en la 001, sin cambiar el firewall del PC:

```powershell
C:\src\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081
C:\src\Android\Sdk\platform-tools\adb.exe reverse tcp:8000 tcp:8000
cd apps/mobile
$env:EXPO_PUBLIC_API_URL="http://localhost:8000"
bunx expo start --dev-client --clear
```

Si cambian las migraciones locales o se agrega código nativo, hay que reinstalar la development
build (`installDebug`). Esta feature no agrega código nativo.

## 3. Recorrido manual

Con una cuenta nueva y el onboarding terminado en COP. Anotar los resultados en
`checklists/quickstart-run.md`.

| # | Paso | Esperado | Escenario |
|---|---|---|---|
| 1 | Tocar "+", escribir `18.000`, tocar "Restaurantes y domicilios", "Guardar" | Gasto en "Efectivo" con fecha de hoy, en 3 toques más el monto; saldo −18.000 | 1.1, 1.2, SC-001 |
| 2 | Cambiar a "ingreso" | Solo se ven las 8 categorías de ingreso | 1.3 |
| 3 | Intentar guardar con monto `0` o sin categoría; escribir `18000,50` en COP | No se guarda y se dice qué falta; COP no acepta decimales | 1.5, 1.6 |
| 4 | Modo avión → registrar 2 gastos → quitar el modo avión | Aparecen al instante; al volver la red llegan al servidor una sola vez | 1.4, 1.7, SC-002 |
| 5 | Crear "Nequi", billetera digital, COP, saldo inicial `80.000`, y marcarla por defecto | Saldo 80.000; "Efectivo" deja de ser la predeterminada; "+" trae "Nequi" | 3.1–3.3 |
| 6 | Crear otra cuenta llamada "nequi" | No se permite: el nombre ya existe | 3.5 |
| 7 | Crear "Ahorros USD" en USD y transferir `10` USD → `40.000` COP a "Nequi" | Se piden los dos montos; los saldos cambian; no aparece como gasto ni ingreso | 5.1–5.3 |
| 8 | Ver Inicio con cuentas COP y USD | Cada saldo en su moneda; no se muestra un total que las mezcle | 2.4, FR-012 |
| 9 | Editar el gasto del paso 1 a `20.000`; luego borrarlo y tocar "Deshacer" | El saldo baja 2.000; al borrar desaparece; "Deshacer" lo devuelve | 4.1, 4.4, 4.5 |
| 10 | Ajustar "Nequi" a un saldo real distinto | Se crea un ajuste por la diferencia, sin categoría; el saldo queda igual al real | 6.1, 6.2 |
| 11 | Archivar "Ahorros USD" (con saldo) | Avisa el saldo; sale de Inicio y del total; aparece en "cuentas archivadas" con su historial | 3.6, FR-021 |
| 12 | Intentar archivar la cuenta por defecto | Pide elegir antes otra cuenta por defecto | 3.7 |
| 13 | Intentar cambiar la moneda de "Nequi" (tiene movimientos) | No se permite | 3.8 |
| 14 | Forzar un rechazo del servidor (ver nota) | El movimiento sigue en el historial con "no se pudo guardar" y el motivo; al corregirlo se envía | FR-037 |
| 15 | Abrir el historial con 5.000 movimientos de prueba (script de siembra) en modo avión | Historial y saldos en menos de 1 s | SC-004 |

**Nota del paso 14**: con el backend apagado, editar la base local no es práctico; la forma
simple es registrar un gasto en una cuenta y, antes de que se envíe, borrar esa cuenta en el
servidor con SQL (`DELETE FROM accounts WHERE id = '…'` en la base de desarrollo). El servidor
rechazará el gasto por cuenta desconocida.

## 4. Revisión de logs (SC-006)

Revisar las líneas que escribió el backend durante el recorrido: no deben aparecer montos
(`18000`, `80000`, `40000`) ni descripciones de movimientos. La prueba automática de logs de la
001 se amplía para cubrir los endpoints de esta feature.
