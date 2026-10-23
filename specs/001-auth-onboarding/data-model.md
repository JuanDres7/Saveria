# Data Model: Registro, inicio de sesión y onboarding

**Feature**: `001-auth-onboarding` | **Fecha**: 2026-10-22

Convenciones para todo el proyecto:

- Ids `uuid`. Los que crea el servidor usan UUID v7 (ordenables por tiempo); las entidades
  sincronizables aceptan el UUID generado en el cliente.
- Fechas `timestamptz` (UTC).
- Montos `numeric(19,4)` + `char(3)` con el código ISO 4217. Nunca `float`.
- Tablas sincronizables: `created_at`, `updated_at` y `deleted_at` (borrado lógico).
- Borrado de cuenta: **todas** las tablas con `user_id` usan `ON DELETE CASCADE`. Las features
  futuras (movimientos, relatos, memoria de conceptos) MUST seguir esta regla para cumplir
  FR-024.

---

## Servidor (PostgreSQL)

### `users`

Identidad y credenciales. No es sincronizable (solo la modifica el servidor).

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | v7, generado por el servidor |
| `email` | text | Normalizado: `trim` + minúsculas (caso límite). Único. FR-002 |
| `password_hash` | text | bcrypt cost 12. FR-026 |
| `email_verified_at` | timestamptz null | `null` = sin verificar. FR-031 |
| `policy_version` | text | Versión de la política aceptada. FR-004 |
| `policy_accepted_at` | timestamptz | FR-004 |
| `created_at` | timestamptz | Base del plazo de 7 días. FR-032 |
| `updated_at` | timestamptz | |

- Índice único sobre `email`. Como el borrado es definitivo (FR-025), el correo queda libre de
  inmediato, sin índice parcial.
- `verification_deadline` = `created_at + 7 días`; se calcula, no se guarda.

### `user_profiles` (sincronizable)

Preferencias del onboarding y de Configuración. Relación 1:1 con `users` (`id` = `users.id`).

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK, FK → `users.id` cascade | |
| `ai_name` | varchar(30) null | Opcional, ≤ 30 caracteres después de `trim`; vacío = `null`. FR-017 |
| `country_code` | char(2) null | ISO 3166-1 alfa-2 del catálogo, o `ZZ` = "Otro" |
| `city` | varchar(80) null | Texto libre |
| `primary_currency` | char(3) null | ISO 4217 del catálogo. `null` = no puede registrar movimientos. FR-015 |
| `reference_currencies` | char(3)[] | 0 a 2 elementos, distintos entre sí y de `primary_currency`. FR-020 |
| `ai_mode` | enum `manual`/`auto` | Por defecto `manual`. FR-013 |
| `onboarding_step` | enum | `ai_name` → `country` → `city` → `currency` → `ai_mode` → `done`. FR-011, FR-014 |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | `updated_at` es el reloj del cliente (LWW, ver research §6) |

**Reglas**

- Al cambiar `primary_currency` a una moneda que estaba en `reference_currencies`, se quita de esa
  lista.
- `onboarding_step` solo avanza. Al pasar a `done` se exige `primary_currency` no nula.
- Pasar `ai_mode` a `auto` requiere que el cliente envíe la confirmación (`autoModeConfirmed:
  true`). Es una regla de la API: la app la pide después de mostrar la explicación (FR-019).

**Transición del onboarding**

```text
ai_name ──► country ──► city ──► currency ──► ai_mode ──► done
                                     │
                     (FR-015: aquí ya hay primary_currency)
```

### `sessions`

Una fila por dispositivo con sesión iniciada. Es la base para revocar al instante.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | v7; viaja como claim `sid` en el JWT |
| `user_id` | uuid FK → `users.id` cascade | Índice |
| `device_id` | uuid | Id aleatorio del dispositivo (SecureStore) |
| `device_name` | varchar(80) null | Ej. "Samsung A54"; informativo |
| `refresh_token_hash` | char(64) | SHA-256 del refresh token actual |
| `previous_refresh_token_hash` | char(64) null | Si vuelve a llegar → reutilización → revocar |
| `created_at` | timestamptz | |
| `last_used_at` | timestamptz | Se actualiza en cada refresh |
| `expires_at` | timestamptz | `last_used_at + 30 días`. FR-008 |
| `revoked_at` | timestamptz null | Cerrar sesión, cambio o reset de contraseña, reutilización |

- Un login nuevo desde el mismo `device_id` revoca la sesión anterior de ese dispositivo.
- Las sesiones vencidas o revocadas se purgan en un job diario (se pueden borrar a los 30 días).

### `one_time_tokens`

Enlaces de verificación y recuperación (FR-028 a FR-035).

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | v7 |
| `user_id` | uuid FK → `users.id` cascade | |
| `kind` | enum `email_verification`/`password_reset` | |
| `token_hash` | char(64) único | SHA-256 del token; el token en claro solo existe en el correo |
| `target_email` | text | Correo al que se envió (cubre el cambio de correo sin verificar) |
| `expires_at` | timestamptz | Verificación +24 h; recuperación +30 min |
| `used_at` | timestamptz null | Uso único |
| `invalidated_at` | timestamptz null | Se marca al emitir uno nuevo del mismo tipo |
| `created_at` | timestamptz | |

**Válido** = `used_at IS NULL AND invalidated_at IS NULL AND expires_at > now()`.
Para verificación, además `target_email = users.email`; así un cambio de correo invalida los
enlaces viejos.

### `accounts` (sincronizable, mínima en esta feature)

Solo se crea la cuenta "Efectivo" (FR-016). La feature 002 agrega el resto de los campos y la
gestión completa.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | Generado por el cliente (idempotente) |
| `user_id` | uuid FK → `users.id` cascade | |
| `name` | varchar(40) | "Efectivo" |
| `currency` | char(3) | Moneda principal al completar el onboarding. Nunca cambia sola (FR-021) |
| `initial_balance` | numeric(19,4) | `0` |
| `is_default` | boolean | Como mucho una por usuario (índice único parcial `WHERE is_default AND deleted_at IS NULL`) |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | |

---

## Redis (efímero)

| Clave | Valor | TTL | Uso |
|---|---|---|---|
| `rl:login:{ip}:{sha256(email)}` | contador | 15 min | 5 fallos → 429 (FR-007) |
| `rl:login-ip:{ip}` | contador | 15 min | 100 fallos → 429 (límite general) |
| `rl:pwd:{userId}:{ip}` | contador | 15 min | Cambio de contraseña y borrado de cuenta |
| `rl:mail:{kind}:{sha256(email)}` | contador | 1 h | 3 correos por dirección (FR-035) |

En las claves se usa el hash del correo, nunca el correo en claro.

---

## Catálogos fijos (`packages/shared/src/catalog`)

- **Country**: `code` (ISO 3166-1), `name` (español), `suggestedCurrency` (ISO 4217 o `null`).
- **Currency**: `code`, `name`, `symbol`, `decimals` (0 para CLP/PYG, 2 para el resto).
- **PrivacyPolicy**: `currentVersion` (ej. `2026-10-v1`) y la URL de la página.

---

## Cliente (SQLite cifrado, un archivo por usuario)

| Tabla | Propósito |
|---|---|
| `profile` | Copia local de `user_profiles` (una fila) |
| `accounts` | Copia local de `accounts` |
| `outbox` | Cambios pendientes: `id`, `entity` (`profile`, …), `entity_id`, `operation`, `payload` (JSON), `created_at`, `attempts`, `last_error` |
| `meta` | Clave-valor: `last_server_check_at`, `email_verified`, `verification_deadline` |

**Fuera de la base (SecureStore)**: `device_id`, `refresh_token`, `user_id` de la última sesión,
`dbkey:{userId}`.

**Reglas**

- Abrir la app sin conexión con una sesión guardada carga directamente la base del `user_id`
  guardado (SC-003, < 2 s).
- Cerrar sesión: se borra el refresh token y la base se cierra, pero se conservan el archivo y su
  clave (FR-010).
- Borrar la cuenta: se borran el archivo, su clave y el refresh token.
- Al sincronizar el outbox después de entrar: si el servidor responde que el usuario no existe,
  se descarta el archivo de ese usuario.
