---

description: "Tareas de la feature 001-auth-onboarding"
---

# Tasks: Registro, inicio de sesión y onboarding

**Input**: Documentos de diseño en `specs/001-auth-onboarding/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/openapi.yaml](contracts/openapi.yaml),
[quickstart.md](quickstart.md)

**Tests**: OBLIGATORIAS por la Constitución VIII. Cada escenario de aceptación tiene al menos una
prueba según la matriz de `plan.md`. Dentro de cada historia, las pruebas se escriben primero y
deben fallar antes de implementar.

**Organization**: Tareas agrupadas por historia de usuario para implementarlas y probarlas por
separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos y sin dependencias pendientes)
- **[Story]**: historia de usuario a la que pertenece (US1…US6)

## Path Conventions

- Backend: `apps/api/src/`, pruebas en `apps/api/tests/{unit,contract,integration}/`
- App: `apps/mobile/src/` (rutas de Expo Router en `apps/mobile/src/app/`), pruebas en
  `apps/mobile/tests/`
- Compartido: `packages/shared/src/`
- Comandos: Bun (`bun`, `bunx`). En la app las dependencias se instalan con `bunx expo install`.
  Compilación Android con `JAVA_HOME=C:\Program Files\Java\jdk-21`.
- Patrón validado de base cifrada: `spikes/sqlcipher-drizzle/RESULTADO.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo, herramientas y servicios locales

- [X] T001 Crear `package.json` raíz con `"private": true`, `"workspaces": ["apps/*", "packages/*"]` y scripts `lint` (`biome check .`) y `format` (`biome format --write .`); crear `tsconfig.base.json` con `strict: true`, `moduleResolution: "bundler"`, `target: "ESNext"`; ampliar `.gitignore` raíz con `apps/api/.dev-outbox/`, `apps/mobile/android/`, `apps/mobile/ios/`, `.expo/`, `*.log`
- [X] T002 [P] Agregar Biome 2.6 como devDependency raíz y crear `biome.json` (formato con 2 espacios, comillas simples, ancho 100; ignorar `node_modules`, `drizzle/`, `apps/mobile/android`, `spikes/`)
- [X] T003 [P] Crear `docker-compose.yml` con `postgres` (imagen `pgvector/pgvector:pg17`, base `saveria`, volumen nombrado, healthcheck `pg_isready`, puerto 5432 publicado solo en `127.0.0.1` para desarrollo), `redis` (`redis:7.4-alpine`, healthcheck `redis-cli ping`, puerto 6379 solo en `127.0.0.1`) y `api` (`build: { context: ., dockerfile: apps/api/Dockerfile }`, perfil `full`, puerto 8000, depende de postgres y redis sanos); crear `docker/postgres/init.sql` que cree la base `saveria_test` y la extensión `vector` en ambas
- [X] T004 [P] Crear el paquete `packages/shared` (`package.json` con nombre `@saveria/shared`, `src/index.ts`, `tsconfig.json` que extiende `tsconfig.base.json`), con `zod@^4.6` como dependencia
- [X] T005 [P] Crear el proyecto `apps/api` (`package.json` con nombre `@saveria/api`, `tsconfig.json` que extiende la base con `jsx: "react-jsx"` y `jsxImportSource: "hono/jsx"`); instalar `hono@^4.13`, `@hono/zod-validator@^0.9`, `zod@^4.6`, `drizzle-orm@^0.45`, `postgres@^3.4`, `jose@^6.2`, `ioredis@^6.0`, `resend@^6.34`, `pino@^10.4`, `@scalar/hono-api-reference@^0.12`, `@saveria/shared` (workspace) y como dev `drizzle-kit@^0.31`, `@types/bun`, `ajv`, `ajv-formats`, `yaml`; scripts `dev` (`bun --watch src/main.ts`), `test` (`bun test`), `db:generate` (`drizzle-kit generate`), `db:migrate` (`drizzle-kit migrate`)
- [X] T006 [P] Crear `apps/api/.env.example` con `PORT=8000`, `DATABASE_URL`, `DATABASE_URL_TEST`, `REDIS_URL`, `JWT_SECRET` (comentario: mínimo 32 bytes aleatorios), `PUBLIC_BASE_URL=http://localhost:8000`, `EMAIL_PROVIDER=dev-outbox`, `RESEND_API_KEY=`, `EMAIL_FROM`, `TRUSTED_PROXY_HOPS=0`, `NODE_ENV=development`
- [X] T007 [P] Crear `apps/api/Dockerfile` sobre `oven/bun:1.4`: copiar `package.json`, `bun.lock`, `packages/shared` y `apps/api`; `bun install --frozen-lockfile --production`; `USER bun` (sin privilegios); `EXPOSE 8000`; `CMD ["bun", "apps/api/src/main.ts"]`; agregar `.dockerignore` en la raíz (`node_modules`, `apps/mobile`, `spikes`, `.git`, `*.log`, `apps/api/.dev-outbox`)
- [X] T008 Crear la app en `apps/mobile` con `bunx create-expo-app@latest apps/mobile` (plantilla con Expo Router, SDK 58, rutas en `src/app/`), renombrar a `@saveria/mobile` y borrar las pantallas de ejemplo; instalar con `bunx expo install` `expo-sqlite expo-secure-store expo-crypto expo-file-system expo-dev-client expo-device @react-native-community/netinfo` y con `bun add` `drizzle-orm@0.45.4 zustand@^5 react-hook-form@^7.90 @hookform/resolvers@^6 openapi-fetch@^0.17 zod@^4.6 @saveria/shared`; dev: `openapi-typescript@^7.13 jest-expo @testing-library/react-native@^14`
- [X] T009 Configurar `apps/mobile/app.json`: `android.package = "com.saveria.app"`, `android.allowBackup = false`, plugin `["expo-sqlite", { "useSQLCipher": true }]`, `scheme = "saveria"`; agregar script `android` (`expo run:android`) y `test` (`jest`) con preset `jest-expo` en `apps/mobile/package.json`; agregar script `api:types` que ejecute `openapi-typescript ../../specs/001-auth-onboarding/contracts/openapi.yaml -o src/api/schema.d.ts`
- [X] T010 Ejecutar `bun install` en la raíz, `docker compose up -d postgres redis` y `bun run --cwd apps/mobile api:types`; verificar que `bunx biome check .` pasa sin errores

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Núcleo del backend y de la app del que dependen todas las historias

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta terminar esta fase

### Compartido

- [ ] T011 [P] Crear el catálogo de monedas en `packages/shared/src/catalog/currencies.ts`: `code`, `name` (español), `symbol`, `decimals`, con exactamente ARS, BOB, BRL, CLP, COP, CRC, CUP, DOP, GTQ, HNL, MXN, NIO, PAB, PEN, PYG, UYU, VES, USD, EUR (`decimals: 0` para CLP y PYG, `2` para el resto); exportar `isSupportedCurrency(code)`
- [ ] T012 [P] Crear el catálogo de países en `packages/shared/src/catalog/countries.ts`: `code` (ISO 3166-1 alfa-2), `name` (español), `suggestedCurrency` (ISO 4217 o `null`), con los países de América Latina, `US` → USD, `ES` → EUR y `ZZ` "Otro" → `null`; exportar `suggestedCurrencyFor(countryCode)`
- [ ] T013 [P] Crear `packages/shared/src/catalog/privacy-policy.ts` con `PRIVACY_POLICY_VERSION = "2026-10-v1"` y la ruta `/legal/privacy`
- [ ] T014 [P] Crear reglas Zod compartidas en `packages/shared/src/validation/`: `email.ts` (`z.string().trim().toLowerCase().pipe(z.email().max(254))`), `password.ts` (mínimo 8 caracteres, máximo 1024, al menos una letra y un número; FR-003), `profile.ts` (`aiName` opcional ≤ 30 caracteres después de `trim`, vacío → `null`; `countryCode` del catálogo; `city` ≤ 80; `primaryCurrency` del catálogo o `null`; `referenceCurrencies` 0–2 únicas y distintas de `primaryCurrency`; `aiMode` `manual`|`auto`; `onboardingStep` enum `ai_name`, `country`, `city`, `currency`, `ai_mode`, `done`); reexportar todo desde `packages/shared/src/index.ts`
- [ ] T015 [P] Pruebas unitarias de catálogos y validaciones en `packages/shared/tests/validation.test.ts`: normalización de `"  Ana@Mail.com "` → `ana@mail.com`; `clave1234` válida y `clavelarga` / `12345678` inválidas; moneda de referencia igual a la principal se rechaza; Colombia sugiere COP; `ZZ` no sugiere nada

### Backend: configuración, base de datos y transversales

- [ ] T016 Crear `apps/api/src/config.ts`: leer y validar con Zod las variables de T006 (fallar al arrancar si `JWT_SECRET` tiene menos de 32 bytes); exportar un objeto `config` tipado
- [ ] T017 Crear el esquema Drizzle en `apps/api/src/infrastructure/db/schema.ts` siguiendo [data-model.md](data-model.md) al pie de la letra: `users` (`email` text único normalizado, `password_hash`, `email_verified_at` timestamptz null, `policy_version`, `policy_accepted_at`, `created_at`, `updated_at`); `user_profiles` (`id` PK y FK → `users.id` on delete cascade, `ai_name` varchar(30) null, `country_code` char(2) null, `city` varchar(80) null, `primary_currency` char(3) null, `reference_currencies` char(3)[] default `{}`, `ai_mode` enum `manual`/`auto` default `manual`, `onboarding_step` enum default `ai_name`, `created_at`, `updated_at`, `deleted_at`); `sessions` (`user_id` uuid **null** FK → `users.id` **on delete set null**, `device_id` uuid, `device_name` varchar(80) null, `refresh_token_hash` char(64), `previous_refresh_token_hash` char(64) null, `rotated_at` null, `created_at`, `last_used_at`, `expires_at`, `revoked_at` null, `revoke_reason` enum null `logout`/`password_changed`/`password_reset`/`reuse_detected`/`replaced`/`account_deleted`); `one_time_tokens` (`kind` enum `email_verification`/`password_reset`, `token_hash` char(64) único, `target_email`, `expires_at`, `used_at` null, `invalidated_at` null, FK cascade); `accounts` (`id` uuid del cliente, `user_id` FK cascade, `name` varchar(40), `currency` char(3), `initial_balance` numeric(19,4) default 0, `is_default` boolean, `created_at`, `updated_at`, `deleted_at`, índice único parcial `(user_id) WHERE is_default AND deleted_at IS NULL`). Todas las fechas en `timestamptz`
- [ ] T018 Crear `apps/api/drizzle.config.ts` y `apps/api/src/infrastructure/db/client.ts` (postgres.js + Drizzle; exportar `createDb(url)`), generar la primera migración con `bun run db:generate` en `apps/api/drizzle/` y aplicarla con `bun run db:migrate` contra `saveria` y `saveria_test`
- [ ] T019 [P] Crear los errores de dominio en `apps/api/src/domain/errors.ts` con un `code` por cada valor del enum `Error.code` del contrato (`validation_error`, `invalid_credentials`, `unauthorized`, `too_many_attempts`, `email_unavailable`, `policy_not_accepted`, `email_already_verified`, `primary_currency_required`, `account_deleted`, `not_found`, `internal_error`)
- [ ] T020 [P] Crear los puertos en `apps/api/src/application/ports/`: `password-hasher.ts` (`hash`, `verify`), `token-service.ts` (`signAccess({sub, sid})`, `verifyAccess`), `clock.ts` (`now()`), `rate-limiter.ts` (`hit(key, limit, windowSec)` → `{allowed, retryAfterSec}`, `reset(key)`), `email-sender.ts` (`send({to, subject, html, text})`), `random.ts` (`token(bytes)`, `uuidV7()`), y repositorios `user-repository.ts`, `profile-repository.ts`, `session-repository.ts`, `one-time-token-repository.ts`, `account-repository.ts` con los métodos que usan los casos de uso
- [ ] T021 [P] Implementar `apps/api/src/infrastructure/crypto/bun-password-hasher.ts` con `Bun.password` (`algorithm: "bcrypt"`, `cost: 12`) y una función `verifyDummy()` que verifica contra un hash fijo precalculado (anti-enumeración por tiempo)
- [ ] T022 [P] Implementar `apps/api/src/infrastructure/crypto/jose-token-service.ts`: JWT HS256 con `jose`, vida de 15 min, claims `sub` y `sid`; e `apps/api/src/infrastructure/crypto/random.ts` (`crypto.getRandomValues` en base64url, `Bun.randomUUIDv7()`, `sha256Hex()`)
- [ ] T023 [P] Implementar `apps/api/src/infrastructure/redis/redis-rate-limiter.ts` con ioredis (`INCR` + `EXPIRE` en una transacción `MULTI`; `retryAfterSec` a partir de `TTL`)
- [ ] T024 [P] Implementar `apps/api/src/infrastructure/logging/logger.ts` con pino y `redact` para `password`, `currentPassword`, `newPassword`, `token`, `refreshToken`, `accessToken`, `authorization`, `email`, `*.password`, `*.token`
- [ ] T025 [P] Implementar `apps/api/src/infrastructure/email/dev-outbox-sender.ts` (escribe cada correo como `<fecha>-<asunto>.html` en `apps/api/.dev-outbox/`) y `apps/api/src/infrastructure/email/resend-sender.ts` (SDK `resend`); ambos detrás de `EmailSender`; envío después del commit con 3 reintentos (1 s, 5 s, 30 s) sin registrar el contenido
- [ ] T026 Implementar los repositorios Drizzle en `apps/api/src/infrastructure/db/repositories/` (`user`, `profile`, `session`, `one-time-token`, `account`) según los puertos de T020
- [ ] T027 [P] Implementar los middlewares en `apps/api/src/interfaces/http/middleware/`: `client-ip.ts` (con `TRUSTED_PROXY_HOPS = 0` usa `getConnInfo` de `hono/bun`; con N > 0 toma la N-ésima IP desde la derecha de `X-Forwarded-For`), `request-logger.ts` (registra método, **ruta sin query string**, estado y duración; nunca body ni headers), `error-handler.ts` (traduce errores de dominio a `{code, message, fields?}` con el estado del contrato; los 500 nunca exponen detalles), límite de body de 16 KB y `secure-headers` de Hono
- [ ] T028 Implementar `apps/api/src/interfaces/http/middleware/auth.ts`: verifica el JWT y luego carga la sesión `sid`. Si la sesión no existe, está revocada o vencida, responde `401 unauthorized`; si `revoke_reason = account_deleted`, responde `401` con `code: account_deleted`. Deja `userId` y `sessionId` en el contexto
- [ ] T029 Crear `apps/api/src/main.ts` (composición: instancia adaptadores, casos de uso y rutas con inyección manual; elige el sender según `EMAIL_PROVIDER`), `apps/api/src/app.ts` (`createApp(deps)` exportable para pruebas) y la ruta `GET /health` → `{"status":"ok"}`; servir `/docs` con Scalar leyendo `specs/001-auth-onboarding/contracts/openapi.yaml` solo si `NODE_ENV !== "production"`
- [ ] T030 [P] Crear los dobles de prueba en `apps/api/tests/support/`: repositorios en memoria, `FakeClock`, `FakeEmailSender` (guarda los correos en un arreglo), `InMemoryRateLimiter`, y `test-app.ts` que levanta `createApp` contra `DATABASE_URL_TEST` y Redis real, y limpia las tablas entre pruebas
- [ ] T031 [P] Crear el validador de contrato en `apps/api/tests/support/contract.ts`: carga `contracts/openapi.yaml` con `yaml`, compila los esquemas de respuesta con `ajv` + `ajv-formats` y expone `expectMatchesContract(method, path, status, body)`
- [ ] T032 [P] Prueba de contrato de `GET /health` en `apps/api/tests/contract/health.test.ts` y prueba de integración del middleware de auth (sin token, firma inválida, sesión revocada, `account_deleted`) en `apps/api/tests/integration/auth-middleware.test.ts`

### App: base local cifrada, sesión, cliente API y outbox

- [ ] T033 Implementar `apps/mobile/src/db/open-user-db.ts` con el patrón validado en el spike: `openDatabaseSync("saveria-<userId>.db")` → si `PRAGMA cipher_version` no devuelve fila, lanzar error y **no abrir** → `PRAGMA key = "x'<hex>'"` con una clave de 32 bytes guardada en SecureStore como `dbkey:<userId>` (si no existe, se crea) → `drizzle(conn)` → migraciones. Si la base no abre con su clave (`file is not a database`), borrar el archivo y crear una base nueva
- [ ] T034 [P] Crear el esquema local en `apps/mobile/src/db/schema.ts` (`profile`, `accounts`, `outbox` con `id`, `entity`, `entity_id`, `operation`, `payload` JSON, `created_at`, `attempts`, `last_error`; `meta` clave-valor) y sus migraciones empaquetadas en `apps/mobile/src/db/migrations/` (generadas con `drizzle-kit generate` con `dialect: "sqlite"`, `driver: "expo"`)
- [ ] T035 [P] Implementar `apps/mobile/src/session/secure.ts` sobre `expo-secure-store`: `getOrCreateDeviceId()` (UUID aleatorio), `get/set/clearRefreshToken()`, `get/setLastUserId()`, `deleteDbKey(userId)`
- [ ] T036 Implementar `apps/mobile/src/session/session-store.ts` con Zustand (`status`: `unknown` | `signedOut` | `signedIn`; `me`; `accessToken` solo en memoria; `isOnline`), conectado a NetInfo
- [ ] T037 Implementar `apps/mobile/src/api/client.ts` con `openapi-fetch` y los tipos de `src/api/schema.d.ts`: base `EXPO_PUBLIC_API_URL` (por defecto `http://10.0.2.2:8000`), agrega `Authorization`, y ante un `401` hace **un solo refresh en vuelo** (*single-flight*) y reintenta. Si el refresh responde `account_deleted`, llama a `purgeUserData(userId)` (T038); si responde otro `401`, pasa a `signedOut` sin borrar la base local
- [ ] T038 Implementar `apps/mobile/src/db/purge.ts` (`purgeUserData(userId)`: cerrar y borrar `saveria-<userId>.db`, borrar `dbkey:<userId>` y el refresh token) y `apps/mobile/src/outbox/outbox.ts` (`enqueue`, `count`, `flush`: envía en orden de `created_at` cuando hay conexión y sesión, reintenta con backoff y registra `last_error`)
- [ ] T039 Crear `apps/mobile/src/app/_layout.tsx` con las guardas de navegación: `unknown` → splash; `signedOut` → `(auth)`; `signedIn` con `onboardingStep !== "done"` → `(onboarding)`; `verificationRequired && isOnline` → `(app)/verify-email-gate`; en otro caso → `(app)`
- [ ] T040 [P] Pruebas de la app en `apps/mobile/tests/foundation.test.tsx`: guardas de `_layout` para cada estado, single-flight (dos 401 simultáneos → un solo refresh), `outbox.count/flush` con `fetch` simulado, y `purgeUserData` borra archivo y clave (SQLite y SecureStore simulados)
- [ ] T041 Compilar la development build (`bun run --cwd apps/mobile android`) en el emulador `saveria_spike` y confirmar en el log `cipher_version` y la apertura de la base del usuario

**Checkpoint**: Base lista. Las historias pueden empezar.

---

## Phase 3: User Story 1 - Crear una cuenta y entrar (Priority: P1) 🎯 MVP

**Goal**: Registro con política aceptada, login, logout, renovación de tokens y mensajes genéricos

**Independent Test**: Crear una cuenta, cerrar sesión y volver a entrar (escenarios 1.1–1.7)

### Tests for User Story 1 ⚠️

- [ ] T042 [P] [US1] Pruebas unitarias en `apps/api/tests/unit/register.test.ts`: correo normalizado; contraseña inválida → `validation_error`; `policyAccepted` falso o versión distinta de `PRIVACY_POLICY_VERSION` → `policy_not_accepted`; correo repetido → `email_unavailable`; crea en la misma transacción `users` + `user_profiles` (`onboarding_step = ai_name`, `ai_mode = manual`) + sesión
- [ ] T043 [P] [US1] Pruebas unitarias en `apps/api/tests/unit/login.test.ts`: credenciales correctas → tokens; contraseña mala y correo inexistente → mismo `invalid_credentials` (y el correo inexistente llama a `verifyDummy`); 5 fallos de la misma IP + correo → `too_many_attempts` con `retryAfterSec`; el mismo correo desde otra IP sí entra; 100 fallos por IP → bloqueo general; login exitoso reinicia el contador; login desde el mismo `device_id` revoca la sesión anterior con `replaced`
- [ ] T044 [P] [US1] Pruebas de contrato en `apps/api/tests/contract/auth-us1.test.ts` para `POST /v1/auth/register` (201, 400, 409, 422), `POST /v1/auth/refresh` (200, 401), `POST /v1/auth/login` (200, 401, 429 con header `Retry-After`), `POST /v1/auth/logout` (204 con access token, con solo `refreshToken` y con un token inválido), `GET /v1/me` (200, 401) y `GET /v1/legal/privacy-policy` (200)
- [ ] T045 [P] [US1] Pruebas de integración en `apps/api/tests/integration/us1-auth.test.ts`: escenarios 1.1–1.6 por HTTP (registro → `GET /v1/me`; logout → el mismo access token recibe 401 de inmediato; logout solo con `refreshToken` revoca la sesión)
- [ ] T046 [P] [US1] Pruebas unitarias en `apps/api/tests/unit/refresh.test.ts`: rotación (el token nuevo funciona y el actual pasa a `previous_refresh_token_hash` con `rotated_at`); el token anterior **dentro de 60 s** devuelve un par nuevo; **después de 60 s** revoca con `reuse_detected`; vencimiento deslizante (`expires_at = last_used_at + 30 días`); sesión vencida → `401`; sesión `account_deleted` → `401 account_deleted`

### Implementation for User Story 1

- [ ] T047 [US1] Implementar el caso de uso `apps/api/src/application/use-cases/register.ts` (valida con `@saveria/shared`, verifica política, hashea, crea usuario + perfil + sesión en una transacción y devuelve `AuthResponse`)
- [ ] T048 [US1] Implementar `apps/api/src/application/use-cases/issue-session.ts` (compartido por register y login): crea la sesión (`expires_at = now + 30 días`), genera el refresh token `<sid>.<32 bytes base64url>`, guarda solo su SHA-256 y firma el access token
- [ ] T049 [US1] Implementar `apps/api/src/application/use-cases/login.ts` (limitador `rl:login:{ip}:{sha256(email)}` 5/15 min y `rl:login-ip:{ip}` 100/15 min; `verifyDummy` si el correo no existe; revoca la sesión anterior del mismo `device_id`)
- [ ] T050 [US1] Implementar `apps/api/src/application/use-cases/logout.ts` (revoca con `revoke_reason = logout` la sesión del access token o, si no viene, la sesión a la que pertenece el `refreshToken` del body, actual o anterior; responde 204 siempre) y `apps/api/src/application/use-cases/get-me.ts` (arma `Me`: `verificationDeadline = created_at + 7 días`, `verificationRequired = !emailVerified && now > deadline`, perfil y `defaultAccount` o `null`)
- [ ] T051 [US1] Implementar `apps/api/src/application/use-cases/refresh.ts` (reglas de T046) y la ruta `POST /v1/auth/refresh`
- [ ] T052 [US1] Implementar las rutas en `apps/api/src/interfaces/http/routes/auth.ts` (`register`, `login`, `logout`) y `apps/api/src/interfaces/http/routes/me.ts` (`GET /v1/me`), validando con `@hono/zod-validator`; y `apps/api/src/interfaces/http/routes/legal.ts` (`GET /v1/legal/privacy-policy` y la página `GET /legal/privacy` con JSX, texto provisional que cumple FR-005: datos recogidos, uso de país y ciudad, procesamiento de relatos con un proveedor externo de IA y cómo borrar los datos)
- [ ] T053 [P] [US1] Crear las pantallas `apps/mobile/src/app/(auth)/welcome.tsx`, `register.tsx` (correo, contraseña, casilla de política con enlace a `/legal/privacy`; botón deshabilitado sin aceptar; aviso "necesitas internet" sin conexión) y `login.tsx` (mensaje genérico ante 401 o 429) con react-hook-form + reglas de `@saveria/shared`
- [ ] T054 [US1] Implementar `apps/mobile/src/features/auth/auth-service.ts`: `register`, `login` (guarda el refresh token, abre la base del usuario, sincroniza `me` en la base local y vacía el outbox) y `logout` (si hay outbox pendiente muestra el aviso informativo "Tienes N cambios sin sincronizar; se enviarán cuando vuelvas a entrar" sin bloquear (FR-010a); llama a `POST /v1/auth/logout` si hay red; si no hay red, guarda el refresh token en SecureStore como `pendingRevocation` y lo envía a `POST /v1/auth/logout` en cuanto vuelva la conexión (luego lo borra); borra el refresh token de la sesión; cierra la base **sin borrarla**; pasa a `signedOut`)
- [ ] T055 [P] [US1] Pruebas de la app en `apps/mobile/tests/us1-auth.test.tsx`: registro sin política deshabilitado (1.2), mensaje genérico en login (1.5), logout limpia el estado visible (1.6) logout sin conexión con 1 ítem en el outbox muestra el aviso y conserva la base (1.7), y al volver la red se envía `pendingRevocation` y se borra

**Checkpoint**: US1 funciona por sí sola (registro, login y logout de punta a punta)

---

## Phase 4: User Story 2 - Onboarding inicial (Priority: P1)

**Goal**: Onboarding de 5 pasos retomable, con la cuenta "Efectivo" al terminar

**Independent Test**: Registrar una cuenta, completar el onboarding y ver "Efectivo" en la moneda principal (escenarios 2.1–2.6)

### Tests for User Story 2 ⚠️

- [ ] T056 [P] [US2] Pruebas unitarias en `apps/api/tests/unit/update-profile.test.ts`: `onboarding_step` solo avanza; pasar a `done` exige `primary_currency`; LWW (`updatedAt` del cliente mayor → aplica; menor o igual → `409` con la versión del servidor); `aiMode` de `manual` a `auto` exige `autoModeConfirmed: true`; quitar de `reference_currencies` la moneda que pasa a ser principal; `aiName` vacío → `null`
- [ ] T057 [P] [US2] Pruebas unitarias en `apps/api/tests/unit/complete-onboarding.test.ts`: sin `primary_currency` → `primary_currency_required`; crea "Efectivo" (`currency = primary_currency`, `initial_balance = 0`, `is_default = true`) con el `defaultAccountId` del cliente; repetir la llamada con el mismo id no duplica (idempotente)
- [ ] T058 [P] [US2] Pruebas de contrato en `apps/api/tests/contract/me-us2.test.ts` para `PUT /v1/me/profile` (200, 400, 409) y `POST /v1/me/onboarding/complete` (200, 422)
- [ ] T059 [P] [US2] Pruebas de integración en `apps/api/tests/integration/us2-onboarding.test.ts`: recorrido completo, retomar desde `city` (2.5) y `GET /v1/me` devuelve `defaultAccount` (2.4)

### Implementation for User Story 2

- [ ] T060 [US2] Implementar `apps/api/src/application/use-cases/update-profile.ts` (reglas de T056; guarda `updated_at` = `updatedAt` del cliente)
- [ ] T061 [US2] Implementar `apps/api/src/application/use-cases/create-default-account.ts` (reutilizable por la feature 002) y `apps/api/src/application/use-cases/complete-onboarding.ts` (en una transacción: crea la cuenta por defecto si no existe y pone `onboarding_step = done`)
- [ ] T062 [US2] Agregar `PUT /v1/me/profile` y `POST /v1/me/onboarding/complete` en `apps/api/src/interfaces/http/routes/me.ts`
- [ ] T063 [US2] Implementar `apps/mobile/src/features/profile/profile-service.ts`: guarda cada cambio primero en la tabla local `profile` (con `updatedAt = now`) y lo encola en el outbox (`PUT /v1/me/profile`); ante un `409` adopta la versión del servidor
- [ ] T064 [P] [US2] Crear las pantallas de onboarding en `apps/mobile/src/app/(onboarding)/`: `ai-name.tsx` (opcional, ≤ 30 caracteres, se puede saltar), `country.tsx` (lista del catálogo), `city.tsx` (texto libre ≤ 80), `currency.tsx` (preselecciona `suggestedCurrencyFor(country)`; sin sugerencia no preselecciona nada) y `ai-mode.tsx` (manual preseleccionado con una explicación breve de manual frente a automático); cada paso guarda su valor y avanza `onboardingStep` con `profile-service`
- [ ] T065 [US2] Implementar el final del onboarding en `apps/mobile/src/features/onboarding/complete.ts`: genera el UUID de "Efectivo" con `expo-crypto`, crea la cuenta en la base local de inmediato y encola `POST /v1/me/onboarding/complete` con `defaultAccountId` (funciona sin conexión; SC-004)
- [ ] T066 [US2] Crear `apps/mobile/src/app/(app)/index.tsx` (pantalla principal provisional: saludo con `aiName` o la parte del correo antes de la "@", y la cuenta "Efectivo" con saldo 0; la entrada "registrar movimiento" solo aparece si hay `primaryCurrency` (2.6))
- [ ] T067 [P] [US2] Pruebas de la app en `apps/mobile/tests/us2-onboarding.test.tsx`: orden de los pasos (2.1), COP preseleccionada para Colombia (2.2), manual por defecto (2.3), "Efectivo" creada sin conexión (2.4), retomar tras reiniciar (2.5), sin moneda no hay "registrar movimiento" (2.6) y con `aiName` vacío el saludo usa la parte del correo antes de la "@" (FR-017)

**Checkpoint**: US1 + US2 forman el MVP (cuenta creada y lista para registrar movimientos)

---

## Phase 5: User Story 3 - Cambiar la configuración del perfil (Priority: P2)

**Goal**: Configuración editable sin conexión y cambio de contraseña

**Independent Test**: Cambiar cada ajuste, reiniciar la app y verificar que se conserva (escenarios 3.1–3.6)

### Tests for User Story 3 ⚠️

- [ ] T068 [P] [US3] Pruebas unitarias en `apps/api/tests/unit/change-password.test.ts`: contraseña actual incorrecta → `invalid_credentials` sin cerrar sesiones; nueva inválida → `validation_error`; éxito → revoca todas las demás sesiones con `password_changed` y mantiene la actual; limitador `rl:pwd:{userId}:{ip}`
- [ ] T069 [P] [US3] Pruebas de contrato en `apps/api/tests/contract/auth-us3.test.ts` para `POST /v1/auth/password/change` (204, 400, 401, 429)
- [ ] T070 [P] [US3] Pruebas de integración en `apps/api/tests/integration/us3-settings.test.ts`: dos sesiones; cambiar la contraseña → la otra recibe 401 de inmediato y la actual sigue (3.5); contraseña actual mala no cierra nada (3.6); cambiar `primary_currency` no cambia `accounts.currency` de "Efectivo" (3.3); hasta 2 monedas de referencia (3.2)

### Implementation for User Story 3

- [ ] T071 [US3] Implementar `apps/api/src/application/use-cases/change-password.ts` y la ruta `POST /v1/auth/password/change` en `apps/api/src/interfaces/http/routes/auth.ts`
- [ ] T072 [P] [US3] Crear `apps/mobile/src/app/(app)/settings/index.tsx` (nombre para la IA, país, ciudad, moneda principal, monedas de referencia hasta 2 distintas de la principal, modo de IA), guardando con `profile-service` (sin conexión aplica local y sincroniza después; 3.4)
- [ ] T073 [US3] Agregar en la pantalla de Configuración la confirmación del modo automático (explica que las acciones de la IA se guardan sin preguntar y se pueden deshacer desde el historial; envía `autoModeConfirmed: true`) (3.1)
- [ ] T074 [P] [US3] Crear `apps/mobile/src/app/(app)/settings/change-password.tsx` (contraseña actual + nueva; requiere conexión)
- [ ] T075 [P] [US3] Pruebas de la app en `apps/mobile/tests/us3-settings.test.tsx`: confirmación del modo automático (3.1), validación de las monedas de referencia (3.2), cambio sin conexión que queda en el outbox y se envía al volver la red (3.4)

**Checkpoint**: US3 funciona sola

---

## Phase 6: User Story 4 - Borrar la cuenta y todos los datos (Priority: P2)

**Goal**: Borrado definitivo en el servidor y en todos los dispositivos

**Independent Test**: Crear una cuenta con datos, borrarla y verificar que no se puede entrar y que el correo queda libre (escenarios 4.1–4.3)

### Tests for User Story 4 ⚠️

- [ ] T076 [P] [US4] Pruebas unitarias en `apps/api/tests/unit/delete-account.test.ts`: contraseña incorrecta → `invalid_credentials`; limitador `rl:pwd`; éxito → en una transacción marca todas las sesiones `revoked_at = now()`, `revoke_reason = account_deleted`, `device_name = null` y luego borra `users` (cascada en perfil, cuentas y tokens)
- [ ] T077 [P] [US4] Pruebas de contrato e integración en `apps/api/tests/integration/us4-delete.test.ts`: `DELETE /v1/me` (204, 401, 429); después las credenciales fallan (4.2), otro dispositivo recibe `401 account_deleted` en refresh y middleware, y registrarse con el mismo correo da una cuenta vacía (4.3); no quedan filas con ese `user_id` en `user_profiles`, `accounts` ni `one_time_tokens`

### Implementation for User Story 4

- [ ] T078 [US4] Implementar `apps/api/src/application/use-cases/delete-account.ts` y la ruta `DELETE /v1/me` en `apps/api/src/interfaces/http/routes/me.ts`
- [ ] T079 [US4] Crear `apps/mobile/src/app/(app)/settings/delete-account.tsx`: explica que no se puede deshacer y que los cambios pendientes se descartan, pide la contraseña y al confirmar llama a `DELETE /v1/me` y a `purgeUserData` (4.1, 4.2)
- [ ] T080 [P] [US4] Pruebas de la app en `apps/mobile/tests/us4-delete.test.tsx`: la pantalla pide la contraseña y muestra que la acción no se puede deshacer y que los cambios pendientes se descartan (4.1); borrar elimina el archivo local y la clave; recibir `account_deleted` en otro dispositivo también los elimina

**Checkpoint**: US4 funciona sola

---

## Phase 7: User Story 6 - Verificar el correo (Priority: P2)

**Goal**: Correo de verificación, reenvío, corrección del correo y bloqueo a los 7 días solo con conexión

**Independent Test**: Registrar una cuenta, abrir el enlace del correo y comprobar que queda verificada (escenarios 6.1–6.5)

### Tests for User Story 6 ⚠️

- [ ] T081 [P] [US6] Pruebas unitarias en `apps/api/tests/unit/email-verification.test.ts`: el registro emite un token `email_verification` (24 h, guardado como SHA-256) y envía el correo; reenviar invalida el anterior (6.3); límite compartido de 3 correos por hora por dirección, sumando verificación y recuperación (2 de verificación + 1 de recuperación agotan el límite), con la misma respuesta neutral (FR-035); corregir el correo solo sin verificar, emite enlace nuevo e invalida los viejos (`target_email` distinto); un token usado, vencido o invalidado no sirve; el correo no contiene datos financieros (FR-036)
- [ ] T082 [P] [US6] Pruebas de contrato en `apps/api/tests/contract/auth-us6.test.ts` para `POST /v1/auth/email/verification` (202, 401), `PUT /v1/auth/email` (202, 400, 401, 409) y las páginas `GET/POST /links/verify-email` (200 `text/html`)
- [ ] T083 [P] [US6] Pruebas de integración en `apps/api/tests/integration/us6-verify.test.ts`: el **GET no consume el token** (abrirlo dos veces sigue mostrando el botón); el POST verifica (6.2); headers `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, CSP `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'` y `X-Frame-Options: DENY`; `verificationRequired` es `true` a los 7 días con `FakeClock` (6.4); los logs no contienen el token

### Implementation for User Story 6

- [ ] T084 [US6] Implementar `apps/api/src/application/use-cases/send-verification-email.ts` (invalida tokens anteriores, crea uno nuevo, limitador compartido `rl:mail:{sha256(email)}` 3/h, envía) y llamarlo desde `register.ts` después del commit (si el envío falla, el registro sigue)
- [ ] T085 [US6] Implementar `apps/api/src/application/use-cases/verify-email.ts`, `resend-verification.ts` y `change-email.ts` (solo sin verificar; normaliza; correo en uso → `409` genérico)
- [ ] T086 [P] [US6] Crear la plantilla `apps/api/src/infrastructure/email/templates/verify-email.ts` (asunto y HTML simple con el enlace `PUBLIC_BASE_URL/links/verify-email?token=…`, sin datos financieros)
- [ ] T087 [US6] Crear la página `apps/api/src/interfaces/http/pages/verify-email.tsx` (JSX de Hono, estilos inline, sin recursos externos; GET muestra el botón "Confirmar mi correo" o "enlace no válido"; POST consume y muestra "Listo, ya puedes volver a la app") con los headers de T083, y montar `/links/verify-email` en `apps/api/src/app.ts`
- [ ] T088 [US6] Agregar `POST /v1/auth/email/verification` y `PUT /v1/auth/email` en `apps/api/src/interfaces/http/routes/auth.ts`
- [ ] T089 [P] [US6] Crear en la app el recordatorio de verificación en `apps/mobile/src/features/verification/VerifyBanner.tsx` (con botón "reenviar") y la pantalla `apps/mobile/src/app/(app)/verify-email-gate.tsx` (reenviar, corregir el correo y "ya verifiqué", que vuelve a consultar `GET /v1/me`); la guarda solo bloquea si hay conexión y el servidor dice `verificationRequired` (6.5); mientras se muestra, el outbox sigue enviando en segundo plano y no se descarta nada (FR-032)
- [ ] T090 [P] [US6] Pruebas de la app en `apps/mobile/tests/us6-verify.test.tsx`: el bloqueo aparece con conexión y `verificationRequired`; sin conexión la app funciona normal (6.5); con el bloqueo visible un cambio pendiente del outbox llega al servidor (FR-032); "ya verifiqué" quita el bloqueo

**Checkpoint**: US6 funciona sola

---

## Phase 8: User Story 5 - Mantener la sesión y recuperarla (Priority: P3)

**Goal**: Arranque sin contraseña con sesión guardada y recuperación de contraseña por correo

**Independent Test**: Entrar, cerrar la app y abrirla sin escribir la contraseña; recuperar el acceso con el enlace del correo (escenarios 5.1–5.5)

### Tests for User Story 5 ⚠️

- [ ] T091 [P] [US5] Pruebas unitarias en `apps/api/tests/unit/password-reset.test.ts`: `forgot` responde igual exista o no el correo, y aunque se pase el límite compartido `rl:mail:{sha256(email)}` de 3/h (FR-030, FR-035); token de 30 min y uso único; al resetear se revocan todas las sesiones con `password_reset`
- [ ] T092 [P] [US5] Pruebas de contrato en `apps/api/tests/contract/auth-us5.test.ts` para `POST /v1/auth/password/forgot` (202, 400) y las páginas `GET/POST /links/reset-password`
- [ ] T093 [P] [US5] Pruebas de integración en `apps/api/tests/integration/us5-session.test.ts`: recuperar de punta a punta (5.3, 5.4); el GET no consume el token; el segundo uso muestra "no válido" y ofrece pedir otro (5.5); el formulario con contraseña inválida vuelve a mostrarse con errores

### Implementation for User Story 5

- [ ] T094 [US5] Implementar `apps/api/src/application/use-cases/forgot-password.ts` y `reset-password.ts`, la plantilla `apps/api/src/infrastructure/email/templates/reset-password.ts` y la ruta `POST /v1/auth/password/forgot`
- [ ] T095 [US5] Crear la página `apps/api/src/interfaces/http/pages/reset-password.tsx` (GET con formulario de contraseña y confirmación; POST valida con FR-003, consume el token y revoca sesiones; mismos headers que verify-email) y montar `/links/reset-password`
- [ ] T096 [US5] Implementar el arranque con sesión guardada en `apps/mobile/src/features/auth/bootstrap.ts`: con refresh token y `lastUserId`, abrir la base local de inmediato y mostrar la app (< 2 s, SC-003, también sin conexión); refrescar en segundo plano cuando haya red; si la sesión expiró, pasar a `signedOut` conservando la base y, al volver a entrar con el mismo usuario, vaciar el outbox (5.2)
- [ ] T097 [P] [US5] Crear `apps/mobile/src/app/(auth)/forgot-password.tsx` (correo → mensaje neutral "Si el correo está registrado, te llegará un enlace")
- [ ] T098 [P] [US5] Pruebas de la app en `apps/mobile/tests/us5-session.test.tsx`: arranque directo con sesión guardada (5.1), sesión expirada → login → el outbox se envía (5.2), mensaje neutral de recuperación (5.3)

**Checkpoint**: Todas las historias funcionan

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cierre de la feature

- [ ] T099 [P] Prueba de logs sin secretos (SC-006) en `apps/api/tests/integration/logs-redaction.test.ts`: captura la salida de pino durante register, login, refresh, reset y verify, y comprueba que no aparecen la contraseña, los tokens, el header `Bearer` ni `token=`
- [ ] T100 [P] Prueba de aislamiento entre usuarios (FR-027) en `apps/api/tests/integration/isolation.test.ts`: el usuario A no puede leer ni modificar el perfil ni las cuentas de B con su token
- [ ] T101 [P] Job de purga diaria en `apps/api/src/application/use-cases/purge-expired.ts`: borra sesiones vencidas o revocadas hace más de 30 días y tokens de un solo uso vencidos; se programa con `setInterval` en `apps/api/src/main.ts` (una vez al día), con prueba en `apps/api/tests/unit/purge-expired.test.ts`
- [ ] T102 [P] Actualizar `README.md` en la raíz (qué es Saveria, estructura del monorepo, cómo levantar el entorno enlazando a `specs/001-auth-onboarding/quickstart.md`, convención de ramas `main`/`develop`/`feat/*` y conventional commits)
- [ ] T103 Ejecutar `bunx biome check .`, `bun test --cwd apps/api`, `bun test --cwd packages/shared` y `bun run --cwd apps/mobile test`; todo en verde
- [ ] T104 Hacer el recorrido manual de `specs/001-auth-onboarding/quickstart.md` (pasos 1–14, revisión de logs y tiempo de arranque con sesión guardada < 2 s, SC-003) en el emulador `saveria_spike` y registrar el resultado en `specs/001-auth-onboarding/checklists/quickstart-run.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup y **bloquea todas las historias**
- **Historias (Phases 3–8)**: dependen de Foundational
- **Polish (Phase 9)**: depende de las historias terminadas

### User Story Dependencies

- **US1 (P1)**: solo de Foundational
- **US2 (P1)**: necesita una cuenta creada (US1) para su prueba de punta a punta; sus casos de uso no dependen de US1
- **US3 (P2)**: reutiliza `profile-service` de US2 (T063)
- **US4 (P2)**: solo de US1 (necesita una sesión)
- **US6 (P2)**: modifica `register.ts` (T084 depende de T047)
- **US5 (P3)**: solo de US1 (el refresh de tokens ya está en US1)

### Within Each User Story

- Las pruebas se escriben primero y deben fallar
- Casos de uso → rutas → pantallas → pruebas de la app
- Commit (conventional commits) por tarea o grupo lógico en `feat/001-auth-onboarding`

### Parallel Opportunities

- Setup: T002–T007 en paralelo
- Foundational: catálogos (T011–T015), adaptadores (T021–T025), middlewares y soporte de pruebas (T027, T030–T032) y la parte móvil (T034, T035) en paralelo
- En cada historia, todas las pruebas [P] en paralelo y las pantallas [P] en paralelo con el backend
- US3, US4 y US6 pueden avanzar en paralelo después de US2

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo:
Task: "Pruebas unitarias de registro en apps/api/tests/unit/register.test.ts"
Task: "Pruebas unitarias de login en apps/api/tests/unit/login.test.ts"
Task: "Pruebas de contrato en apps/api/tests/contract/auth-us1.test.ts"
Task: "Pruebas de integración en apps/api/tests/integration/us1-auth.test.ts"

# Pantallas en paralelo con los casos de uso:
Task: "Pantallas welcome/register/login en apps/mobile/src/app/(auth)/"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 (Setup) y Phase 2 (Foundational)
2. Phase 3 (US1): registro y login
3. Phase 4 (US2): onboarding y "Efectivo"
4. **Validar**: pasos 1–5 del quickstart en el emulador
5. Merge a `develop` por PR

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 + US2 → MVP (la app queda lista para la feature de movimientos)
3. US3 → configuración
4. US4 → borrado (obligatorio antes de usuarios reales)
5. US6 → verificación de correo
6. US5 → sesión larga y recuperación
7. Polish → PR final a `develop`

---

## Notes

- [P] = archivos distintos y sin dependencias pendientes
- En los textos de la app se dice "cuenta de dinero" (Efectivo, Nequi…) para no confundirla con la cuenta del usuario
- Toda decisión técnica ya está tomada en `plan.md` y `research.md`; si una tarea contradice la
  spec, se corrige primero la spec (Constitución, flujo de desarrollo)
- No se crea `services/ai` (FastAPI) en esta feature
