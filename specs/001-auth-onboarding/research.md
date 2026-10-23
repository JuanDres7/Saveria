# Research: Registro, inicio de sesión y onboarding

**Feature**: `001-auth-onboarding` | **Fecha**: 2026-10-22

Versiones consultadas en npm el 2026-10-22. Se fijan con `^` al crear los proyectos y se
actualizan solo a propósito.

Cada herramienta se explica en tres líneas: **qué es**, **por qué** se eligió y qué se
**descartó**. Regla general del proyecto: se agregan *librerías* cuando ahorran trabajo; no se
agregan *servicios en ejecución* fuera de la constitución.

---

## 1. Organización del repositorio

### Monorepo con Bun workspaces

- **Qué es**: un solo repositorio con varias carpetas-proyecto (`apps/api`, `apps/mobile`,
  `packages/shared`) que comparten dependencias y código. Bun lo maneja con `workspaces` en el
  `package.json` raíz.
- **Por qué**: la app y el backend comparten catálogos (países, monedas) y los tipos del contrato.
  Un solo `bun install`, un solo historial de git, una sola rama por feature.
- **Descartado**: repos separados (duplica código y PRs); Turborepo/Nx (útiles con muchos
  paquetes, sobra para 3).

### Biome 2.6 (lint + formato)

- **Qué es**: una sola herramienta que revisa errores comunes (linter) y formatea el código.
- **Por qué**: reemplaza ESLint + Prettier con un archivo de configuración y es muy rápida.
- **Descartado**: ESLint + Prettier (dos herramientas, más configuración y plugins).

> Hooks de commit (lefthook/commitlint) quedan fuera de 001: los conventional commits se siguen
> a mano. Se reconsideran si aparecen errores repetidos.

---

## 2. Backend principal (`apps/api`)

### Bun 1.4 (runtime) — fijado por la constitución

- **Qué es**: el programa que ejecuta TypeScript en el servidor (como Node, pero más rápido e
  incluye test runner, bundler y gestor de paquetes).
- **Uso aquí**: servidor HTTP, `bun test`, `bun install`, `Bun.password` para bcrypt,
  `Bun.randomUUIDv7()` para ids del servidor.

### Hono 4.13 (framework HTTP)

- **Qué es**: un framework mínimo para definir rutas (`app.post('/v1/auth/login', ...)`),
  middlewares y respuestas. Corre igual en Bun, Node o Cloudflare.
- **Por qué**: muy liviano, buena integración con Bun, middlewares listos (CORS, secure headers,
  límite de tamaño de body) y **JSX en servidor** para las páginas web de los enlaces (FR-037) sin
  agregar un motor de plantillas.
- **Descartado**: Elysia (más "mágico" y atado a Bun; si algún día se cambia de runtime, toca
  reescribir); Express (lento en Bun y sin tipos de primera clase).

### Zod 4.6 (validación)

- **Qué es**: define la forma de un dato (`z.object({ email: z.email() })`) y valida entradas en
  tiempo de ejecución, generando también el tipo TypeScript.
- **Por qué**: valida todo lo que llega a la API y los formularios de la app con las mismas reglas
  (FR-002, FR-003, FR-017). El correo se normaliza **antes** de validar el formato:
  `z.string().trim().toLowerCase().pipe(z.email())`. Integración con Hono vía `@hono/zod-validator` 0.9 y con formularios
  vía `@hookform/resolvers`.
- **Descartado**: Valibot (más pequeño, menos ecosistema); validar a mano.

### Drizzle ORM 0.45 + drizzle-kit 0.31 — fijado por la constitución

- **Qué es**: el ORM define las tablas en TypeScript y permite consultas tipadas;
  `drizzle-kit` genera los archivos de migración SQL a partir de cambios en ese esquema.
- **Uso aquí**: esquema en `apps/api/src/infrastructure/db/schema.ts`, migraciones SQL
  versionadas en git (`drizzle-kit generate` + `drizzle-kit migrate`). Nunca `push` contra
  producción.
- **Driver**: `postgres` (postgres.js 3.4), el driver más usado con Drizzle y estable en Bun.
  Descartado `Bun.sql` nativo: funciona, pero tiene menos recorrido con Drizzle.

### Contraseñas: `Bun.password` con bcrypt (cost 12)

- **Qué es**: función integrada de Bun que hashea y verifica contraseñas con bcrypt.
- **Por qué**: cumple la constitución (bcrypt) sin dependencia nativa extra. Contraseñas de más de
  72 bytes (límite de bcrypt) **no se truncan**: Bun las pre-hashea con SHA-512, así que no hace
  falta tope en la spec. Se limita el body HTTP a 16 KB para evitar abuso.
- Detrás del puerto `PasswordHasher` para que los casos de uso no dependan de Bun.
- **Descartado**: paquete `bcrypt` (compilación nativa, problemas en Windows/Docker);
  `bcryptjs` (JS puro, más lento).

### Tokens: `jose` 6.2 (JWT)

- **Qué es**: librería estándar para firmar y verificar JSON Web Tokens.
- **Diseño de sesión** (decisión clave):
  - **Access token**: JWT HS256, vida 15 min, claims `sub` (usuario) y `sid` (sesión).
  - **Validación en cada request**: el middleware verifica la firma **y** que la sesión `sid`
    exista y no esté revocada (una consulta por clave primaria). Así, cerrar sesión, cambiar o
    recuperar contraseña y borrar la cuenta (FR-009, FR-018a, FR-029, FR-025) cortan el acceso
    **de inmediato**, sin esperar a que venza el JWT.
  - **Refresh token**: opaco, formato `<sid>.<32 bytes aleatorios base64url>`; en la base solo se
    guarda su SHA-256. Se **rota** en cada uso.
  - **Ventana de gracia de 60 s**: en redes móviles la respuesta del refresh se puede perder y el
    cliente reintenta con el token anterior. Si el token anterior llega dentro de los 60 s
    siguientes a la rotación, se emite un par nuevo. Si llega después, se trata como robo y se
    revoca la sesión.
  - **Cuenta borrada**: si la sesión fue revocada por borrado de cuenta, refresh y middleware
    responden `401` con `code: account_deleted`. La app borra entonces el archivo local y la clave
    de ese usuario (FR-010, FR-024).
  - **Vencimiento deslizante**: `expires_at = último uso + 30 días` (FR-008).
  - **Cliente**: un solo refresh en vuelo a la vez (*single-flight*); las peticiones que reciben 401
    esperan ese refresh. Evita que dos refresh paralelos parezcan reutilización.
- **Descartado**: sesiones solo con cookie (la app móvil no es navegador); JWT sin consulta de
  sesión (no permite revocar al instante); Lucia/Better Auth (la constitución pide auth propia).

### Redis: `ioredis` 6.0

- **Qué es**: cliente para hablar con Redis desde TypeScript.
- **Uso aquí**: contadores con vencimiento para el límite de intentos de login (FR-007) y de
  correos (FR-035).
- **Por qué ioredis y no `Bun.redis`**: la feature de registro por IA usará colas con BullMQ, que
  requiere ioredis. Se usa una sola librería desde el inicio.

### Correo: `resend` 6.34 detrás de la interfaz `EmailSender`

- **Qué es**: SDK oficial del proveedor de correo elegido en la constitución.
- **Implementaciones**: `ResendEmailSender` (producción) y `DevOutboxEmailSender` (desarrollo y
  pruebas: escribe cada correo como archivo `.html` en `apps/api/.dev-outbox/`, ignorado por git).
  Así no se agrega ningún contenedor de correo falso.
- **Limitación**: sin un dominio verificado, Resend solo envía al correo del dueño de la cuenta
  de Resend. Antes de usuarios reales hay que verificar un dominio.
- **Reintentos**: el envío se hace después de confirmar la transacción, con 3 reintentos en
  proceso (1 s, 5 s, 30 s). Si falla, el registro igual queda hecho y el usuario puede reenviar.
  No hay tabla de salida (outbox) para no guardar tokens en claro.
- **Plantillas**: funciones TypeScript que devuelven HTML simple. Descartado React Email
  (otra dependencia y paso de build para 2 correos).

### Logs: `pino` 10.4

- **Qué es**: logger JSON rápido.
- **Reglas** (FR-026, SC-006): el logger HTTP propio registra método, **ruta sin query string**,
  estado y duración; nunca body, headers de autorización ni query. `redact` en pino para
  `password`, `token`, `refreshToken`, `authorization`, `email`. Una prueba automática revisa que
  esos valores no aparezcan en los logs.

### Documentación de la API: `@scalar/hono-api-reference` 0.12 (solo desarrollo)

- **Qué es**: muestra el `openapi.yaml` como página navegable en `/docs`.
- **Por qué**: permite probar endpoints a mano sin Postman. Desactivado en producción.

---

## 3. Contrato de la API (Constitución VII)

### Contract-first: `contracts/openapi.yaml` escrito a mano

- **Qué es**: un archivo OpenAPI 3.1 que describe cada endpoint, sus entradas y respuestas. Es la
  fuente de la verdad, escrita **antes** del código.
- **De ahí salen**:
  - Tipos del cliente móvil con `openapi-typescript` 7.13 + cliente `openapi-fetch` 0.17
    (llamadas tipadas: si el contrato cambia, la app no compila hasta adaptarse).
  - **Pruebas de contrato** del backend: cada respuesta real se valida contra el esquema del YAML
    con `ajv` + `ajv-formats`.
- **Descartado**: generar el OpenAPI desde el código (`@hono/zod-openapi`). Es cómodo, pero
  entonces el contrato es una consecuencia del código y no se puede escribir y revisar antes.
- Los esquemas Zod del backend se escriben a mano y las pruebas de contrato detectan si se
  desalinean con el YAML.

---

## 4. Páginas web de los enlaces (FR-037)

- **Render**: JSX de Hono en el servidor, HTML con estilos inline, **sin recursos externos**
  (sin fuentes, scripts ni imágenes de terceros).
- **GET no consume el token**: los escáneres de correo (Gmail, antivirus) abren los enlaces
  automáticamente. El GET solo muestra un botón ("Confirmar mi correo") o el formulario de
  contraseña nueva; el token se consume en el **POST**.
- **Headers**: `Referrer-Policy: no-referrer`, `Cache-Control: no-store`,
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'`,
  `X-Frame-Options: DENY`.
- **Logs**: el token viaja en la query (`?token=...`) y el logger nunca registra la query.
- **Tokens**: 32 bytes aleatorios, guardados como SHA-256. Pedir uno nuevo del mismo tipo invalida
  los anteriores. Verificación: 24 h; recuperación: 30 min (FR-029, FR-033).

---

## 5. Seguridad del inicio de sesión

### Límite de intentos (FR-007, aclaración de 2026-10-22)

- **Clave**: `login_fail:{ip}:{sha256(email)}`, contador en Redis con TTL de 15 min. Con 5 fallos
  se rechazan nuevos intentos de esa IP a ese correo hasta que venza el TTL. Un login exitoso
  borra el contador.
- **Límite general por IP**: 100 fallos en 15 min desde una IP, para frenar a quien prueba muchos
  correos. Es generoso a propósito: en datos móviles (CGNAT) muchos usuarios comparten IP.
- **El mismo limitador** protege cambiar contraseña y borrar cuenta (ambos piden la contraseña).
- **Respuesta**: `429` con mensaje genérico; no revela si el correo existe.

### IP real del cliente

- Variable `TRUSTED_PROXY_HOPS` (por defecto `0`): con `0` se usa la IP del socket
  (`getConnInfo` de Hono para Bun); con `N > 0` se toma la N-ésima IP desde la derecha de
  `X-Forwarded-For`. Así nadie falsifica su IP enviando el header si no hay proxy delante.

### Anti-enumeración

- Login con correo inexistente: se verifica la contraseña contra un **hash ficticio** para que el
  tiempo de respuesta sea igual (FR-006).
- Registro con correo existente (escenario 1.3): `409` con mensaje genérico. La spec permite
  rechazarlo, pero el mensaje no dice nada de la cuenta existente.
- Recuperación y reenvío: siempre `202` con el mismo cuerpo (FR-030).

---

## 6. Sincronización de preferencias sin conexión (FR-022, Constitución III)

- **Alcance**: solo el registro de perfil/preferencias del usuario (una fila por usuario). La
  sincronización general de movimientos se define en la feature 006.
- **Estrategia**: *last-write-wins* (gana la última escritura) **por registro completo**:
  - El cliente envía `PUT /v1/me/profile` con todos los campos y su `updatedAt` local.
  - Si `updatedAt` del cliente es mayor que el del servidor, se aplica; si no, el servidor responde
    `409` con su versión actual y el cliente la adopta.
- **Riesgo aceptado**: relojes desajustados entre dispositivos pueden hacer ganar un cambio más
  viejo. Es tolerable para preferencias; no se usa para datos financieros.

---

## 7. App móvil (`apps/mobile`)

### Expo SDK 58 + React Native 0.88 — fijado por la constitución

- **Qué es**: Expo es un conjunto de herramientas sobre React Native que simplifica compilar,
  probar y publicar la app Android.
- **Development build obligatorio**: SQLCipher (abajo) necesita código nativo, así que **Expo Go
  no sirve**. Se compila una app de desarrollo propia (`bunx expo run:android`) con el Android SDK
  local.

### Expo Router 58 (navegación)

- **Qué es**: navegación basada en archivos (`app/(auth)/login.tsx` = pantalla de login).
- **Por qué**: hace simple separar las zonas "sin sesión", "onboarding" y "app", con
  redirecciones según el estado. Es el estándar actual de Expo.

### Base local: `expo-sqlite` 58 con **SQLCipher** + Drizzle (driver `expo-sqlite`)

- **Qué es**: SQLite es una base de datos en un archivo dentro del celular; SQLCipher la cifra
  completa. Drizzle se usa también aquí, así que hay un solo ORM en todo el proyecto.
- **Diseño (aclaración del 2026-10-22, FR-010)**:
  - Un archivo por usuario: `saveria-<userId>.db`.
  - Clave aleatoria de 32 bytes por usuario, guardada en `expo-secure-store` (respaldado por el
    Android Keystore).
  - La app solo abre el archivo del usuario autenticado; `PRAGMA key` se ejecuta justo al abrir,
    antes de pasarle la conexión a Drizzle.
  - Al cerrar sesión se cierra el archivo (sin borrarlo); al borrar la cuenta se borran archivo y
    clave.
- **Riesgo aceptado**: el aislamiento entre usuarios del mismo celular lo hace la app, no el
  sistema operativo; quien tenga root en el teléfono podría sacar la clave del Keystore. Es
  suficiente para el MVP.
- **Compatibilidad Drizzle + SQLCipher (investigado el 2026-10-22)**:
  - Expo SDK 58 soporta SQLCipher oficialmente en Android, activándolo con `useSQLCipher: true`
    en el config plugin de expo-sqlite. La clave se pone con `PRAGMA key` justo después de abrir
    la base.
  - Se revisó el código fuente de `drizzle-orm@0.45.4/expo-sqlite`. `drizzle(client)` solo guarda
    la conexión que recibe: no abre conexiones propias y ejecuta todo (consultas, `begin`/`commit`,
    savepoints, migraciones) con `prepareSync`/`executeSync` sobre esa misma conexión. Si la
    conexión ya recibió `PRAGMA key`, todo lo que haga Drizzle va cifrado.
  - Orden obligatorio: `openDatabaseSync(archivo)` → verificar `PRAGMA cipher_version` → `PRAGMA
    key` → `drizzle(conexión)` → migraciones.
  - **Guarda contra fallo silencioso**: sin SQLCipher en el binario (Expo Go, o una build sin
    `prebuild`), `PRAGMA key` no hace nada ni da error, y la base queda **sin cifrar**. Si
    `PRAGMA cipher_version` no devuelve fila, la app MUST negarse a abrir la base. Hay una prueba
    para eso.
  - **Clave perdida**: Android Auto Backup podría restaurar el archivo en otro celular sin la
    clave del Keystore, y entonces la base no se puede leer ("file is not a database"). Se desactiva
    el respaldo de esas bases (`android.allowBackup: false`). Si aun así la base no abre con su
    clave, se descarta y se vuelve a descargar del servidor; solo se pierde lo que no se había
    sincronizado.
  - **Limitaciones aceptadas**: Drizzle Studio y drizzle-kit no abren bases cifradas, lo que solo
    afecta la depuración en el celular. Las migraciones del cliente no dependen de drizzle-kit en
    el dispositivo: se generan en el PC y se empaquetan como SQL. SQLCipher es algo más lento que
    SQLite normal, pero no se nota con el volumen de un usuario.
  - **Validado con un spike el 2026-10-22: 7/7** (`spikes/sqlcipher-drizzle/RESULTADO.md`). En un
    emulador Android 16 se probaron SQLCipher 4.17 activo, migración de Drizzle, transacción y
    rollback, archivo cifrado (verificado también con `adb`), rechazo con clave equivocada y sin
    clave, y reapertura con la clave correcta.
- **Descartado**: AsyncStorage (no es base de datos ni cifra); WatermelonDB (trae su propio
  modelo de sync que choca con la feature 006); MMKV cifrado (clave-valor, no sirve para
  movimientos).

### `expo-secure-store` 58

- Guarda en el Keystore: refresh token, id del dispositivo (UUID aleatorio generado al instalar)
  y claves de las bases locales. El access token vive solo en memoria.

### Estado y formularios

- **Zustand 5** para el estado de sesión en memoria (usuario actual, tokens, si está en línea).
  Más simple que Redux y sin el boilerplate de Context.
- **react-hook-form 7.90 + Zod** para formularios (registro, login, onboarding, configuración).
- **@react-native-community/netinfo 12** para saber si hay conexión (puerta de verificación,
  FR-032; cola de cambios, FR-022).
- **Descartado**: TanStack Query (útil para datos remotos cacheados; aquí la fuente de verdad será
  la base local).

### Cola local de cambios (*outbox*)

- Tabla `outbox` en la base local: cada cambio pendiente (en 001: cambios de perfil) se guarda
  ahí y se envía cuando hay conexión y sesión. El aviso de cierre de sesión (FR-010a) cuenta sus
  filas. Las features 003 y 006 reutilizan esta misma cola para movimientos.

---

## 8. Infraestructura

### Docker Compose

- `postgres`: imagen `pgvector/pgvector:pg17` (PostgreSQL 17 oficial con pgvector preinstalado;
  esta feature aún no usa vectores, pero se deja la extensión lista).
- `redis`: imagen oficial `redis:7.4-alpine`.
- `api`: imagen oficial `oven/bun:1.4`. En desarrollo el API corre fuera de Docker
  (`bun --watch`) y solo Postgres y Redis van en contenedores.
- **No se crea** el contenedor de FastAPI en esta feature.

### Catálogos fijos (países, monedas, versión de la política)

- Viven en `packages/shared/src/catalog/` como constantes TypeScript versionadas con el código.
  No hay tabla en la base: son fijos y cambian solo con un despliegue.
- **Monedas del MVP**: las de los países de América Latina + USD + EUR (ARS, BOB, BRL, CLP, COP,
  CRC, CUP, DOP, GTQ, HNL, MXN, NIO, PAB, PEN, PYG, UYU, VES, USD, EUR).
- **Países**: los de América Latina, Estados Unidos, España y "Otro" (sin moneda sugerida).

---

## 9. Pruebas (Constitución VIII)

| Tipo | Herramienta | Qué cubre |
|---|---|---|
| Unitarias backend | `bun test` | Casos de uso con repositorios falsos en memoria |
| Contrato | `bun test` + `ajv` | Respuestas reales vs `contracts/openapi.yaml` |
| Integración backend | `bun test` + Postgres/Redis del compose | Flujos completos por HTTP contra una base de pruebas |
| App móvil | `jest-expo` 58 + `@testing-library/react-native` 14 | Pantallas, guardas de navegación, outbox |

- E2E en dispositivo (Maestro) queda fuera de 001. Los escenarios de UI se cubren con pruebas de
  componentes y una pasada manual guiada por `quickstart.md`.

---

## 10. Entorno de desarrollo (Windows)

Revisado en la máquina del desarrollador el 2026-10-22:

| Herramienta | Estado |
|---|---|
| Docker 29.2 | Instalado |
| Node 24.14 | Instalado (lo usa la CLI de Expo/Metro por debajo) |
| Android SDK (`C:\src\Android\Sdk`) | Instalado |
| Java 21 y 25 | Instalados. **Se compila con JDK 21** (validado en el spike): `JAVA_HOME=C:\Program Files\Java\jdk-21` |
| Bun 1.4.4 | Instalado el 2026-10-22 |
| Emulador Android 16 (`saveria_spike`) | Instalado el 2026-10-22, con aceleración WHPX |
