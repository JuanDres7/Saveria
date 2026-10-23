# Implementation Plan: Registro, inicio de sesión y onboarding

**Branch**: `feat/001-auth-onboarding` | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-auth-onboarding/spec.md`

## Summary

Primera feature de Saveria. Crea el monorepo, el backend principal y la app Android, y entrega
identidad y preferencias:

- Registro con aceptación de la política.
- Login con JWT de vida corta + refresh token rotativo, con revocación inmediata por sesión.
- Verificación de correo y recuperación de contraseña con enlaces de un solo uso que abren
  páginas web mínimas del backend.
- Onboarding retomable con creación de la cuenta "Efectivo".
- Configuración con sincronización *last-write-wins*.
- Cambio de contraseña y borrado definitivo de la cuenta.

En la app, cada usuario tiene su propia base SQLite cifrada con SQLCipher y una cola local de
cambios (*outbox*) que las siguientes features reutilizan. Las herramientas y su justificación
están en [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x en todo el proyecto. Bun 1.4 (backend). Expo SDK 58 /
React Native 0.88 (app).

**Primary Dependencies**:

- Backend: Hono 4.13, Zod 4.6, Drizzle ORM 0.45 + drizzle-kit 0.31, postgres.js 3.4,
  jose 6.2, ioredis 6.0, resend 6.34, pino 10.4.
- App: Expo Router, expo-sqlite (SQLCipher), expo-secure-store, Drizzle (driver expo-sqlite),
  Zustand 5, react-hook-form 7.90, NetInfo 12, openapi-fetch 0.17.
- Herramientas de desarrollo: Biome 2.6, openapi-typescript 7.13.

**Storage**: PostgreSQL 17 (imagen `pgvector/pgvector:pg17`), Redis 7.4 (contadores de límite)
y, en el dispositivo, SQLite cifrado con un archivo por usuario.

**Testing**:

- Backend: `bun test`, con pruebas unitarias, de contrato (`ajv` contra `openapi.yaml`) y de
  integración contra Postgres y Redis reales.
- App: `jest-expo` + React Native Testing Library.

**Target Platform**: Android (development build propia). Backend en Linux con Docker.

**Project Type**: app móvil + API (monorepo).

**Performance Goals**:

- Abrir la app con la sesión guardada lleva a la pantalla principal en menos de 2 s (SC-003).
- Login p95 por debajo de 500 ms en el servidor (bcrypt cost 12 ≈ 250 ms).
- Correos encolados para envío en menos de 1 s (SC-007).

**Constraints**:

- Offline primero: todo menos el registro, el login y los flujos de correo funciona sin red.
- Los logs nunca contienen secretos.
- Body de máximo 16 KB.
- Un solo desarrollador.

**Scale/Scope**:

- Prototipo con cientos de usuarios.
- Unas 9 pantallas en la app: bienvenida, registro, login, olvidé mi contraseña, 5 pasos de
  onboarding, recordatorio y bloqueo de verificación, Configuración, cambiar contraseña y
  borrar cuenta.
- 14 endpoints JSON y 3 páginas HTML.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo se cumple | Estado |
|---|---|---|
| I. Dos puertas, un caso de uso | Esta feature no crea datos financieros que la IA pueda proponer. "Efectivo" se crea en un caso de uso `CreateDefaultAccount` que la feature 002 reutiliza | ✅ |
| II. La IA propone | Solo se elige `ai_mode`; manual por defecto y automático con confirmación explícita (FR-013, FR-019) | ✅ |
| III. Offline primero | UUID del cliente para `accounts`. `created_at`/`updated_at`/`deleted_at` en `user_profiles` y `accounts`. Outbox local. Estrategia de conflicto definida aquí (LWW por registro, research §6) solo para el perfil | ✅ |
| IV. Precisión monetaria | `numeric(19,4)` + `char(3)`; el contrato envía montos como texto. Cambiar la moneda principal no toca montos ni monedas existentes (FR-021) | ✅ |
| V. Categorización en capas | No aplica en esta feature | N/A |
| VI. Privacidad | Aceptación y versión de la política. Borrado definitivo con `ON DELETE CASCADE`. bcrypt. Tokens de enlace como SHA-256, de un solo uso y con vencimiento corto. Mensajes neutrales. Logs sin secretos ni query strings. Correos sin datos financieros | ✅ |
| VII. Clean Architecture y contratos | Capas `domain` / `application` / `infrastructure` / `interfaces`; puertos para hasher, tokens, correo, reloj y repositorios. `contracts/openapi.yaml` escrito antes del código. El contrato con la IA no aplica todavía | ✅ |
| VIII. Pruebas guiadas por la spec | Cada escenario tiene una prueba asignada o un diferimiento explícito (ver la matriz abajo) | ✅ |
| Stack | Solo herramientas permitidas. Ningún servicio nuevo en ejecución (los correos de desarrollo van a archivos) | ✅ |

**Post-diseño (Fase 1)**: re-evaluado tras escribir el modelo de datos y el contrato. Sin
violaciones.

## Matriz de escenarios → pruebas

U = unitaria, C = contrato, I = integración backend, M = app (jest), Q = recorrido manual del
quickstart.

| Escenario | Prueba en 001 | Diferido |
|---|---|---|
| 1.1–1.5 | U + I + C (registro, login, mensajes genéricos) · M (formularios) | — |
| 1.6 | I (logout revoca la sesión) · M (al cerrar sesión se cierra la base local) | — |
| 1.7 | M con un ítem genérico del outbox (cambio de perfil) · M + I (logout sin conexión → `pendingRevocation` → al volver la red la sesión queda revocada) | Con movimientos reales → 003 |
| 2.1–2.5 | U (transiciones de `onboarding_step`) · I · M (orden de pasos, retomar, terminar sin conexión vía outbox) | — |
| 2.6 | M (sin moneda principal no aparece la entrada "registrar movimiento") · U (regla en el perfil) | Validación en el caso de uso de movimientos → 003 |
| 3.1 | M + I (`autoModeConfirmed` obligatorio) | — |
| 3.2 | U + I (guardar y validar hasta 2 monedas de referencia) | Mostrar equivalentes en los totales → 007/008 |
| 3.3 | I (cambiar la moneda principal no cambia la moneda de "Efectivo") | Totales en la nueva moneda → 008 |
| 3.4 | M (outbox) + I (LWW y 409) | — |
| 3.5–3.6 | I (cambio de contraseña revoca las demás sesiones; la actual sigue) | — |
| 4.1–4.3 | I (borrado en cascada, credenciales inválidas, registro nuevo vacío) · M (se borran la base local y la clave) | Cascada de movimientos y relatos → 003/004 (regla en data-model) |
| 4.2 en otro dispositivo | I (refresh y middleware responden `account_deleted`) · M (al recibirlo se borran el archivo y la clave locales) | — |
| 5.1 | M (arranque con refresh token guardado) | — |
| 5.2 | M (sesión vencida → login → el outbox se envía) | Sync de movimientos → 006 |
| 5.3–5.5 | I (respuesta neutral, uso único, revocación, enlace vencido) · C (páginas HTML) | — |
| 6.1–6.5 | I (envío, verificación por POST, reenvío invalida, `verificationRequired`) · M (puerta solo con conexión; el outbox sigue enviando con la puerta visible) | — |
| Casos límite | I (normalización del correo, límite de intentos, 3 correos por hora, cambio de correo) · U (moneda de referencia igual a la principal, nombre vacío para la IA → parte del correo) | — |
| SC-006 | I (prueba que revisa que los logs no contengan secretos) | — |

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-onboarding/
├── plan.md              # Este archivo
├── research.md          # Herramientas y decisiones (Fase 0)
├── data-model.md        # Entidades y reglas (Fase 1)
├── quickstart.md        # Guía de validación (Fase 1)
├── contracts/
│   └── openapi.yaml     # Contrato de la API (Fase 1)
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
package.json                 # workspaces: apps/*, packages/*
biome.json
docker-compose.yml           # postgres, redis, api

packages/
└── shared/
    └── src/
        ├── catalog/         # countries.ts, currencies.ts, privacy-policy.ts
        └── validation/      # reglas Zod compartidas (email, contraseña, perfil)

apps/
├── api/
│   ├── src/
│   │   ├── domain/          # entidades y errores (User, Profile, Session, OneTimeToken)
│   │   ├── application/     # casos de uso + puertos (interfaces)
│   │   │   ├── ports/       # PasswordHasher, TokenService, EmailSender, Clock, RateLimiter, repos
│   │   │   └── use-cases/   # register, login, refresh, logout, change-password, forgot/reset,
│   │   │                    # verify-email, resend-verification, change-email, update-profile,
│   │   │                    # complete-onboarding, create-default-account, delete-account
│   │   ├── infrastructure/
│   │   │   ├── db/          # schema.ts, client.ts, repositorios Drizzle
│   │   │   ├── redis/       # rate limiter
│   │   │   ├── email/       # resend-sender.ts, dev-outbox-sender.ts, templates/
│   │   │   ├── crypto/      # bun-password-hasher.ts, jose-token-service.ts
│   │   │   └── logging/     # pino + redacción
│   │   ├── interfaces/
│   │   │   └── http/
│   │   │       ├── routes/      # auth.ts, me.ts, legal.ts
│   │   │       ├── pages/       # verify-email.tsx, reset-password.tsx, privacy.tsx
│   │   │       └── middleware/  # auth (JWT + sesión), client-ip, request-logger, errores
│   │   ├── config.ts        # variables de entorno validadas con Zod
│   │   └── main.ts          # composición (inyección de dependencias manual)
│   ├── drizzle/             # migraciones SQL generadas
│   ├── .env.example
│   └── tests/
│       ├── unit/
│       ├── contract/
│       └── integration/
└── mobile/
    ├── src/
    │   ├── app/             # Expo Router (convención de Expo SDK 58: rutas en src/app)
    │   │   ├── (auth)/      # welcome, register, login, forgot-password
    │   │   ├── (onboarding)/# ai-name, country, city, currency, ai-mode
    │   │   ├── (app)/       # home (placeholder), settings/, verify-email-gate
    │   │   └── _layout.tsx  # guardas: sin sesión / onboarding / verificación / app
    │   ├── api/             # cliente openapi-fetch + tipos generados + refresh single-flight
    │   ├── db/              # apertura SQLCipher por usuario, esquema Drizzle local, migraciones
    │   ├── outbox/          # encolar, contar, enviar
    │   ├── session/         # store Zustand, SecureStore
    │   └── features/        # auth, onboarding, settings (componentes y hooks)
    └── tests/
```

**Structure Decision**: monorepo con Bun workspaces, con dos apps (`api`, `mobile`) y un paquete
compartido. El microservicio de IA (`services/ai`, FastAPI) se creará en la feature de registro
por IA, no en esta.

## Decisiones clave (resumen de research.md)

1. **Revocación inmediata**: el JWT lleva `sid` y el middleware verifica en cada request que la
   sesión siga activa.
2. **Refresh rotativo con detección de reutilización** y 60 s de gracia para reintentos por
   respuestas perdidas en la red. El cliente hace un solo refresh a la vez.
3. **Enlaces de correo**: el GET muestra el botón o el formulario y el POST consume el token. Sin
   recursos externos, con `no-referrer`, y el token nunca aparece en los logs.
4. **Límite de intentos** por IP + hash del correo (5 en 15 min) más un límite general generoso
   por IP. La IP real se toma según `TRUSTED_PROXY_HOPS`.
5. **Anti-enumeración**: hash ficticio en el login y respuestas neutrales en recuperación y
   reenvío.
6. **Perfil offline**: last-write-wins por registro, con `updatedAt` del cliente y `409` si el
   servidor tiene una versión más nueva.
7. **Datos locales**: un SQLite cifrado (SQLCipher) por usuario, con la clave en SecureStore. Al
   cerrar sesión se conserva y al borrar la cuenta se elimina.
8. **Correo en desarrollo**: se escribe a archivos, sin contenedor extra.
9. **Cuenta borrada en otro dispositivo**: las sesiones se conservan revocadas con
   `revoke_reason = account_deleted` y sin datos personales. El otro dispositivo recibe `401` con
   `code: account_deleted` y borra su archivo local y su clave.
10. **Cerrar sesión sin conexión** (escenario 1.7, FR-009): el access token solo vivía en memoria
    y el refresh token sale del almacenamiento de sesión, así que el dispositivo queda sin acceso
    de inmediato. El refresh token se guarda aparte como `pendingRevocation` y la app lo envía a
    `POST /v1/auth/logout` cuando vuelve la conexión, lo que revoca la sesión en el servidor.
    Con red, la revocación es inmediata.
11. **Terminar el onboarding sin conexión** (SC-004): la app crea "Efectivo" localmente con su UUID
    y encola `POST /v1/me/onboarding/complete` en el outbox. La llamada es idempotente por
    `defaultAccountId`, así que el usuario puede registrar movimientos de inmediato.

## Riesgos y validaciones tempranas

- **SQLCipher + Drizzle en expo-sqlite**: **resuelto**. El spike del 2026-10-22 dio 7/7
  (`spikes/sqlcipher-drizzle/RESULTADO.md`). La app usa el patrón validado: verificar
  `cipher_version` → `PRAGMA key` → `drizzle(conexión)` → migraciones.
- **JDK**: resuelto. Se compila con el JDK 21 que ya está instalado (validado en el spike).
- **Resend**: sin dominio verificado solo envía al dueño de la cuenta. Hay que verificar un
  dominio antes de tener usuarios reales.
- **Copias de respaldo (FR-024)**: las copias de Postgres se configuran al desplegar, con una
  retención máxima de 30 días, para que los datos de una cuenta borrada desaparezcan también de
  ellas. En desarrollo no se hacen copias.

## Complexity Tracking

| Elemento | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| SQLCipher (exige development build) | La aclaración de FR-010 pide los datos pendientes cifrados y separados por usuario | SQLite sin cifrar: incumple la aclaración |
| Consulta de sesión en cada request | Revocar al instante (FR-009, FR-018a, FR-029, FR-025) | JWT sin estado: deja la sesión viva hasta 15 min después de revocarla |
| Pruebas de contrato con `ajv` | La Constitución VII exige el contrato antes y validarlo | Generar el contrato desde el código: deja de ser contract-first |
