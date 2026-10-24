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
| Gastos e ingresos manuales, registro por IA, sincronización, resumen del mes | Pendientes |

## Estructura del monorepo

```text
apps/
  api/        Backend: Bun + Hono + Drizzle (PostgreSQL) + Redis, Clean Architecture
  mobile/     App Android: Expo SDK 58 + React Native, SQLite cifrado (SQLCipher) por usuario
packages/
  shared/     Catálogos (monedas, países, política) y validaciones Zod usadas por app y backend
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
[`specs/001-auth-onboarding/quickstart.md`](specs/001-auth-onboarding/quickstart.md). En resumen:

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
