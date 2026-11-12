# Saveria

App de finanzas personales para Android asistida por IA. La idea: registrar tus gastos debe costar
lo mismo que mandar un mensaje. Le cuentas tu día a la app ("almorcé por 18 mil con Nequi") y
Saveria lo convierte en movimientos ya categorizados, que tú confirmas. También funciona sin
conexión y con registro manual.

- Visión y alcance del MVP: [`docs/vision-fase-0.md`](docs/vision-fase-0.md)
- Arquitectura: [`docs/arquitectura.md`](docs/arquitectura.md)
- Reglas del proyecto (mandan sobre todo lo demás): [`.specify/memory/constitution.md`](.specify/memory/constitution.md)

## Estado

| Funcionalidad | Estado |
|---|---|
| [001 — Registro, inicio de sesión y onboarding](specs/001-auth-onboarding/spec.md) | Implementada (historias 1–6) |
| [002 — Cuentas y movimientos manuales](specs/002-accounts-transactions/spec.md) | Implementada (historias 1–6): gastos e ingresos, historial y saldos, cuentas, editar y borrar con "Deshacer", transferencias y ajuste de saldo |
| [003 — Rediseño visual](specs/003-visual-redesign/spec.md) | Implementada (historias 1–7): identidad «La hoja de Saveria», modo claro y oscuro, barra inferior con «+», íconos y letra propia; sin funciones nuevas |
| Registro por IA, sincronización entre dispositivos, resumen del mes, tasas de cambio | Pendientes |

## La app: tema, letra e íconos

- **Colores y medidas** viven solo en `apps/mobile/src/theme/` (paletas clara y oscura, medidas, tipografía). Las pantallas
  los leen con `useTheme()` o `useStyles()`; una prueba falla si aparece un color suelto fuera de `palettes.ts`.
- **Modo claro u oscuro**: sigue al teléfono. En el emulador se cambia sin tocar la app:
  `adb shell cmd uimode night yes` (oscuro) y `adb shell cmd uimode night no` (claro). Para probar letra grande:
  `adb shell settings put system font_scale 1.5` (y `1.0` para volver).
- **Letra**: Bricolage Grotesque (licencia OFL, en `apps/mobile/assets/fonts/`) para títulos y cifras grandes; el cuerpo usa la del sistema.
- **Íconos**: `lucide-react-native` y `react-native-svg`, importados uno por uno desde `apps/mobile/src/ui/icons.ts` (importar
  el índice de lucide agranda el paquete y una prueba lo impide). Cambiar de íconos o de letra pide reconstruir la app de desarrollo.

## Estructura del monorepo

```text
apps/
  api/        Backend: Bun + Hono + Drizzle (PostgreSQL) + Redis, Clean Architecture
  mobile/     App Android: Expo SDK 58 + React Native, SQLite cifrado (SQLCipher) por usuario
packages/
  shared/     Catálogos (monedas, países, categorías, política), dinero exacto, validaciones Zod,
              reglas de cuentas y formato de las acciones de la IA, usados por app y backend
specs/        Una carpeta por funcionalidad (Spec Kit): spec, plan, research, data-model,
              contrato OpenAPI, quickstart y tareas
docs/         Visión y arquitectura
docker/       Script de inicio de PostgreSQL (base de pruebas y extensión pgvector)
spikes/       Experimentos técnicos (por ejemplo, Drizzle sobre SQLCipher)
.specify/     Instalación de Spec Kit (constitución, plantillas, scripts)
.claude/      Comandos de Spec Kit y agentes para Claude Code
```

## Levantar el entorno

La guía completa, con los requisitos de Windows (Bun 1.4, Docker, JDK 21, Android SDK, ninja 1.12)
y un recorrido manual de 14 pasos, está en
[`specs/001-auth-onboarding/quickstart.md`](specs/001-auth-onboarding/quickstart.md); el recorrido
de cuentas y movimientos (15 pasos) está en
[`specs/002-accounts-transactions/quickstart.md`](specs/002-accounts-transactions/quickstart.md).
En resumen:

```powershell
bun install
Copy-Item apps/api/.env.example apps/api/.env      # completar JWT_SECRET
docker compose up -d postgres redis
bun run --cwd apps/api db:migrate
bun run --cwd apps/api dev                          # http://localhost:8000 (contrato en /docs)
bun run --cwd apps/mobile android                   # compila e instala la app en el emulador
```

En desarrollo los correos no se envían: quedan como archivos `.html` en `apps/api/.dev-outbox/`.

## Pruebas

```powershell
bun test --cwd apps/api            # unitarias, de contrato e integración (necesita Docker)
bun test --cwd packages/shared
bun run --cwd apps/mobile test     # jest-expo
bun run --cwd apps/mobile test:sqlite   # consultas locales contra un SQLite real (Bun)
bunx biome check .
```

## Cómo se trabaja

- **Spec Driven Development con Spec Kit**: `/speckit-specify` → `/speckit-clarify` →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`. Si un
  requisito cambia, se actualiza primero la spec y luego el código.
- **Pruebas primero**: cada escenario de aceptación de la spec tiene al menos una prueba.
- **Contrato primero**: la API se describe en `specs/<feature>/contracts/openapi.yaml` antes de
  programarla; la app genera sus tipos desde ahí (`bun run --cwd apps/mobile api:types`).
- **Ramas**: `main` → `develop` → una rama `feat/NNN-nombre` por funcionalidad.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) en inglés, separados
  por zona (`feat(api): ...`, `feat(mobile): ...`, `fix(shared): ...`, `docs(specs): ...`).
