# Documento de Arquitectura y Especificaciones Técnicas: Proyecto "Saveria"

> **Actualizaciones del 2026-10-22** (prevalecen sobre el texto original de abajo; ver también
> `.specify/memory/constitution.md`):
>
> - ORM elegido: **Drizzle**.
> - El endpoint que recibe relatos responde **`202 Accepted`** con un id de tarea; el cliente
>   consulta el resultado (polling en el MVP).
> - La IA devuelve **acciones propuestas**, no transacciones: modo manual por defecto, modo
>   automático opcional con historial y deshacer.
> - **Categorías fijas** (18 de gastos, 8 de ingresos, ver `docs/vision-fase-0.md`): `categories`
>   ya no tiene `user_id`; cada categoría tiene un `slug` estable.
> - **Categorización en capas**: memoria de conceptos por usuario → caché global en Redis (solo
>   categorías) → encoder multilingüe en FastAPI con ejemplos en pgvector → Gemini.
> - Nueva entidad **`accounts`** (efectivo, Nequi, banco), cada una con su moneda ISO 4217. Toda
>   transacción pertenece a una cuenta.
> - **Multimoneda**: montos `DECIMAL` + código de moneda; totales consolidados en la moneda
>   principal usando la tasa del día del movimiento (tabla `exchange_rates`).
> - `users` agrega: nombre para la IA, país, ciudad, moneda principal, modo de IA y aceptación de
>   la política de datos.
> - Todas las tablas sincronizables agregan `updated_at` y `deleted_at`.
> - PostgreSQL usa la extensión **pgvector**.
> - Correo transaccional con **Resend** (verificación de correo y recuperación de contraseña),
>   enviado solo desde el backend principal.

## 1. Visión General del Proyecto
**Saveria** es una aplicación móvil de finanzas personales asistida por Inteligencia Artificial. Su principal diferenciador es permitir al usuario "contarle su día" a la IA mediante lenguaje natural (ej. "Hoy gasté 15 en transporte y 40 en almuerzo"), para que el sistema extraiga, categorice y registre las transacciones automáticamente. También incluye gestión manual de gastos, ingresos, metas de ahorro, deudas y movimientos recurrentes.

**Nota para el LLM (Claude):** Este documento actúa como la fuente de la verdad para el desarrollo. Sigue estrictamente el stack tecnológico y la arquitectura distribuida detallada a continuación. No agregues herramientas (como Firebase, Supabase o MongoDB) que no estén especificadas aquí.

---

## 2. Stack Tecnológico

### 2.1. Frontend (Dispositivo Móvil)
* **Framework:** React Native con Expo (TypeScript).
* **Gestión de Estado y Sincronización:** Preparado para *offline-first*. Los datos se guardan localmente si no hay red y se sincronizan mediante UUIDs cuando la conexión se restablece.
* **UI/UX:** Componentes nativos optimizados (evitar dependencias pesadas de manipulación del DOM web).

### 2.2. Backend Principal (API CRUD - Contenedor 1)
* **Entorno de Ejecución:** Bun.
* **Lenguaje:** TypeScript.
* **Arquitectura de Software:** Clean Architecture (aislar controladores, casos de uso, repositorios y entidades).
* **Autenticación:** Implementación propia (Custom) utilizando JSON Web Tokens (JWT) y cifrado con `bcrypt`.
* **ORM:** Drizzle.

### 2.3. Microservicio de Inteligencia Artificial (Inferencia - Contenedor 2)
* **Framework:** FastAPI (Python).
* **Integración Principal (Procesamiento Complejo):** API de Gemini para procesamiento de lenguaje natural profundo (extracción de entidades múltiples desde relatos largos).
* **Integración Secundaria (Procesamiento Rápido):** Modelos locales/ligeros (como Sentence Encoders de Hugging Face) para categorización de textos cortos de una sola transacción.

### 2.4. Infraestructura, Datos y Almacenamiento
* **Base de Datos:** PostgreSQL (Imagen oficial en Docker) con pgvector.
* **Caché en Memoria y Colas:** Redis (Imagen oficial en Docker). Utilizado para cachear resultados de inferencias de IA repetidas y gestionar la asincronía.
* **Almacenamiento de Archivos (Object Storage):** Cloudflare R2 (API compatible con S3) para guardar las imágenes asociadas a las metas de ahorro.
* **Orquestación:** Docker y Docker Compose.

---

## 3. Topología de Red y Contenedores (Docker Compose)
El entorno de desarrollo y producción debe contar con una red interna donde los servicios se comunican sin exponerse públicamente, excepto el puerto del Backend Principal.

1. `backend_bun`: Expone el puerto `8000`. Es el único puente entre la App Móvil y los demás servicios.
2. `ai_fastapi`: Expone el puerto `8001` (solo para pruebas locales). Se comunica internamente con el backend.
3. `postgres_db`: Puerto `5432` expuesto solo a nivel de red interna de Docker.
4. `redis_cache`: Puerto `6379` expuesto solo a nivel de red interna de Docker.

---

## 4. Flujos Clave de la Arquitectura

### 4.1. Flujo de Procesamiento Asíncrono de IA
Para evitar bloquear el *Event Loop* del backend o la UI del usuario:
1. El móvil envía un relato a Bun.
2. Bun guarda un registro temporal/pendiente en PostgreSQL y responde `202 Accepted` con el id de la tarea.
3. Bun empuja la tarea de IA a una cola (usando Redis).
4. El microservicio de Python consume la tarea, utiliza Gemini para extraer las acciones propuestas y devuelve el JSON estructurado.
5. Bun recibe el JSON, guarda las acciones propuestas y el cliente móvil las obtiene por *polling*. En modo manual el usuario las confirma; en modo automático se ejecutan con los mismos casos de uso del registro manual.

### 4.2. Flujo de Caché para Inferencia (Reducción de Latencia)
1. Bun recibe una transacción simple: "Suscripción Netflix".
2. Bun busca primero en la memoria de conceptos del usuario y luego en `redis_cache` la clave `cat:suscripción netflix`.
3. Si existe (Cache Hit), devuelve la categoría instantáneamente.
4. Si no existe (Cache Miss), consulta al microservicio de Python (encoder y, si no supera el umbral, Gemini), y al recibir la respuesta la guarda en Redis con un TTL de 30 días.

---

## 5. Esquema Base de Base de Datos (PostgreSQL)
Todos los identificadores principales deben ser `UUID` (generados preferiblemente en el cliente móvil para facilitar la sincronización offline).

* **Tabla `users`:** `id (UUID)`, `email`, `password_hash`, `currency`, `created_at`. *(Ver campos nuevos en la nota inicial.)*
* **Tabla `categories`:** `id (UUID)`, `slug`, `name`, `type (ENUM: expense/income)`. *(Lista fija, sin `user_id`.)*
* **Tabla `transactions`:** `id (UUID)`, `user_id (FK)`, `account_id (FK)`, `category_id (FK)`, `amount (DECIMAL)`, `currency`, `type (ENUM)`, `description`, `transaction_date`.
* **Tabla `savings_goals`:** `id (UUID)`, `user_id (FK)`, `title`, `target_amount (DECIMAL)`, `current_amount (DECIMAL)`, `image_url (Cloudflare R2 URL)`, `status`.
* *(Cuentas, deudas, movimientos recurrentes, tasas de cambio y memoria de conceptos se modelan en los planes técnicos de cada funcionalidad.)*
