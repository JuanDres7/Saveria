# Quickstart: validar la feature 001-auth-onboarding

Guía para levantar el entorno y comprobar de punta a punta que la feature cumple la spec.
El contrato está en [contracts/openapi.yaml](contracts/openapi.yaml) y el modelo en
[data-model.md](data-model.md).

## 1. Prerrequisitos (Windows)

| Herramienta | Cómo instalar / verificar |
|---|---|
| Bun 1.4 | `powershell -c "irm bun.sh/install.ps1 \| iex"` → `bun --version` |
| Docker Desktop | `docker --version` (ya instalado) |
| Node 24 | `node --version` (ya instalado; lo usa la CLI de Expo) |
| JDK 21 | Ya instalado: `JAVA_HOME=C:\Program Files\Java\jdk-21` (validado en el spike). Java 25 no se probó |
| Android SDK | `ANDROID_HOME=C:\src\Android\Sdk` (ya configurado) + emulador `saveria_spike` (Android 16) o un celular con depuración USB |
| ninja 1.12+ | **Obligatorio en Windows.** El `ninja 1.10.2` del SDK falla con rutas de más de 260 caracteres. Descargar `ninja-win.zip` de https://github.com/ninja-build/ninja/releases (v1.12.1 o más nueva) y reemplazar `%ANDROID_HOME%\cmake\3.22.1\bin\ninja.exe` (guardar antes una copia) |

> **Expo Go no sirve** para esta app: SQLCipher necesita una *development build* propia.

## 2. Levantar el backend

```powershell
bun install                                  # en la raíz del monorepo
Copy-Item apps/api/.env.example apps/api/.env  # completar JWT_SECRET (32+ bytes aleatorios)
docker compose up -d postgres redis
bun run --cwd apps/api db:migrate
bun run --cwd apps/api dev                   # http://localhost:8000
```

- `GET http://localhost:8000/health` → `{"status":"ok"}`.
- `http://localhost:8000/docs` muestra el contrato navegable (solo en desarrollo).
- En desarrollo los correos **no se envían**: quedan como `.html` en `apps/api/.dev-outbox/`.
  Para probar Resend real, define `EMAIL_PROVIDER=resend` y `RESEND_API_KEY`. Sin dominio
  verificado, Resend solo entrega al correo del dueño de la cuenta.

## 3. Pruebas automáticas

```powershell
bun test --cwd apps/api            # unitarias + contrato + integración (requiere compose arriba)
bun run --cwd apps/mobile test     # jest-expo
bunx biome check .
```

Esperado: todo en verde. Las pruebas de integración usan una base `saveria_test` aparte.

## 4. App móvil

```powershell
bun run --cwd apps/mobile android   # compila la development build e instala en el emulador
```

En el emulador, `10.0.2.2:8000` apunta al backend local (`EXPO_PUBLIC_API_URL`).

## 5. Recorrido manual (escenarios de la spec)

| # | Pasos | Resultado esperado |
|---|---|---|
| 1 | Registrarse sin marcar la política | No deja continuar (1.2) |
| 2 | Registrarse con correo `  Ana@Mail.com ` y contraseña `clave1234` | Entra al onboarding; en `.dev-outbox/` hay un correo de verificación para `ana@mail.com` (1.1, 6.1) |
| 3 | Onboarding: dejar el nombre vacío, elegir Colombia | COP preseleccionada (2.2) y modo manual por defecto con su explicación (2.3) |
| 4 | Cerrar la app en el paso "ciudad" y abrirla | Continúa en "ciudad" con lo ya respondido (2.5) |
| 5 | Terminar el onboarding | Existe la cuenta "Efectivo" en COP con saldo 0 (2.4) |
| 6 | Abrir el enlace del correo en el navegador del PC | El GET muestra un botón; al pulsarlo se verifica. Volver a la app: sin recordatorio (6.2) |
| 7 | 5 logins con contraseña mala | El 6.º responde "demasiados intentos" con mensaje genérico (FR-007) |
| 8 | Modo avión → cambiar ciudad → cerrar sesión | Aviso "1 cambio pendiente" y se cierra la sesión (1.7) |
| 9 | Quitar modo avión → entrar con la misma cuenta | La ciudad nueva llega al servidor (`GET /v1/me`) (FR-010, FR-022) |
| 10 | Configuración → activar modo automático | Explicación + confirmación (3.1) |
| 11 | Configuración → cambiar contraseña con otro dispositivo o sesión abierta | La otra sesión recibe 401 en su siguiente request (3.5) |
| 12 | "Olvidé mi contraseña" con un correo inexistente y con uno existente | Mismo mensaje en ambos casos (5.3, FR-030) |
| 13 | Abrir el enlace de recuperación dos veces | La segunda vez dice que no es válido y ofrece pedir otro (5.5) |
| 14 | Borrar la cuenta con la contraseña | Sale de la app; el login con esas credenciales falla; registrarse otra vez con el mismo correo da una cuenta vacía (4.2, 4.3) |

## 6. Revisión de logs (SC-006)

```powershell
docker compose logs api > logs.txt   # o la salida de `bun run dev`
Select-String -Path logs.txt -Pattern "password|refreshToken|token=|Bearer"
```

Esperado: ninguna coincidencia con valores reales.
