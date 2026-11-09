<!--
Sync Impact Report
- Version change: 1.1.0 → 1.1.1 (PATCH: aclaración de redacción, sin cambio de intención)
- Principios modificados:
  III. Offline primero (la regla de UUID del cliente aplica a las entidades que se pueden crear
  sin conexión; las que solo se crean en línea pueden usar UUID del servidor)
- Secciones añadidas: ninguna
- Secciones eliminadas: ninguna
- Plantillas dependientes: sin cambios; leen esta constitución en tiempo de ejecución.
- Specs afectadas: specs/001-auth-onboarding (user_profiles usa el id del usuario, creado en
  línea al registrarse; queda conforme). Hallazgo C1 de /speckit-analyze.
- TODOs diferidos: ninguno.
-->

# Saveria Constitution

## Core Principles

### I. Dos puertas, un solo caso de uso

Toda operación que crea, modifica o elimina datos financieros (movimientos, cuentas, deudas,
metas, recurrentes) MUST ejecutarse a través de un único caso de uso del backend, sin importar si
la origina un formulario manual o una acción propuesta por la IA.

- La lógica de negocio y las validaciones MUST vivir en ese caso de uso, nunca duplicadas en el
  flujo de IA ni en la app móvil.
- Un módulo nuevo MUST definir a la vez su formulario manual y su tipo de acción para la IA.

**Razón**: evita que la IA y el registro manual se comporten distinto y reduce el código a
mantener por un solo desarrollador.

### II. La IA propone, el usuario decide

Los modelos de IA (Gemini, encoders) NUNCA escriben directamente en la base de datos. Su salida
MUST ser una lista de acciones propuestas, cada una con un tipo (`create_expense`,
`create_income`, `create_debt`, `pay_debt`, `create_recurring`, `create_goal`,
`contribute_goal`, `create_transfer`) y sus datos.

- El modo de IA por defecto MUST ser **manual**: cada acción se muestra en una pantalla de
  confirmación donde el usuario acepta, corrige o descarta.
- El modo **automático** MUST ser opcional y activado explícitamente por el usuario. En ese modo
  se ejecutan todas las acciones, incluidas deudas, metas y recurrentes, y cada ejecución MUST
  quedar en un historial con opción de deshacer.
- Todo dato inferido (monto calculado, cuenta por defecto, fecha asumida) MUST mostrarse marcado
  como inferido.

**Razón**: la IA se equivoca con montos y categorías; el usuario mantiene el control de su
dinero y la confianza en la app.

### III. Offline primero

La app MUST permitir registrar, editar y consultar movimientos sin conexión.

- Las entidades que se pueden crear sin conexión MUST usar UUID generados en el cliente. Las que
  solo se crean en línea (por ejemplo el perfil, creado junto con el usuario al registrarse)
  pueden usar el UUID del servidor, pero MUST cumplir las demás reglas de sincronización.
- Toda tabla sincronizable MUST tener `created_at`, `updated_at` y `deleted_at` (borrado lógico).
- Los cambios locales y los relatos para la IA MUST guardarse en una cola local y enviarse cuando
  vuelva la conexión.
- La estrategia de resolución de conflictos MUST definirse en el plan técnico de la
  funcionalidad de sincronización antes de implementarla.

**Razón**: la fricción de registro es el problema central del producto; depender de la red la
reintroduce.

### IV. Precisión monetaria y multimoneda

- Los montos MUST almacenarse como decimal exacto (`DECIMAL`/`NUMERIC`), nunca como punto
  flotante, y siempre junto a su código de moneda ISO 4217.
- Cada cuenta tiene una moneda; un movimiento usa siempre la moneda de su cuenta y conserva su
  monto original.
- Los totales y resúmenes MUST mostrarse consolidados en la moneda principal del usuario,
  convirtiendo con la tasa de cambio del día del movimiento. Las monedas de referencia
  adicionales son opcionales y configurables.
- Las tasas MUST obtenerse de una fuente externa en un proceso programado y guardarse en el
  sistema; la app móvil NUNCA consulta la fuente directamente.
- Transferencias entre cuentas, abonos a deudas y abonos a metas NO son gastos ni ingresos y NO
  llevan categoría.

**Razón**: errores de redondeo o de conversión destruyen la confianza en una app financiera.

### V. Categorización en capas y costo de IA mínimo

La categorización MUST resolverse con la capa más barata capaz de hacerlo, en este orden:
(1) memoria de conceptos del usuario, (2) caché global de concepto→categoría, (3) encoder de
embeddings contra frases de ejemplo, (4) Gemini como último recurso.

- Las categorías son una lista fija definida por el producto; NO existen categorías
  personalizadas por usuario.
- El "aprendizaje" MUST consistir en guardar confirmaciones y correcciones del usuario (conceptos,
  categorías, precios unitarios); NO se entrenan ni ajustan modelos en el MVP.
- Los precios aprendidos MUST ser por usuario; la caché global NUNCA almacena montos ni datos
  identificables.
- Los ejemplos globales del encoder solo los modifica el equipo del producto.
- Toda llamada a un modelo externo MUST registrarse por usuario (conteo y tipo) para medir costo.

**Razón**: mantiene la latencia baja, el costo por usuario controlado y prepara el modelo
freemium.

### VI. Privacidad y protección de datos

Saveria trata datos financieros personales y MUST cumplir la Ley 1581 de 2012 (Colombia).

- El registro MUST incluir aceptación explícita de la política de tratamiento de datos, que
  informa que los relatos se procesan con un proveedor externo de IA.
- El usuario MUST poder borrar su cuenta y todos sus datos.
- Solo se piden datos con un uso declarado (por ejemplo, país y ciudad para sugerir moneda y dar
  contexto a la IA).
- Logs y métricas NUNCA contienen relatos completos, montos asociados a una identidad,
  contraseñas ni tokens.
- Contraseñas MUST guardarse con `bcrypt`; los datos de un usuario NUNCA se usan para responder a
  otro.
- Los enlaces enviados por correo (verificación, recuperación de contraseña) MUST ser de un solo
  uso, con vencimiento corto, y guardarse solo como hash. Los mensajes de esos flujos MUST NOT
  revelar si un correo está registrado.
- Los correos transaccionales MUST contener solo lo necesario para la acción (nunca montos ni
  datos financieros).

**Razón**: es un requisito legal y la base de la confianza para usuarios reales.

### VII. Clean Architecture y contratos explícitos

- El backend MUST separar entidades, casos de uso, repositorios y controladores; los casos de uso
  no dependen de frameworks, ORM ni proveedores de IA.
- La API pública MUST documentarse en un contrato OpenAPI antes de implementarse.
- El contrato JSON entre el backend principal y el microservicio de IA MUST estar versionado y
  validado en ambos lados.
- Las operaciones de IA de larga duración MUST ser asíncronas: el backend responde `202 Accepted`
  con un identificador de tarea y el cliente consulta el resultado.

**Razón**: permite cambiar de proveedor de IA o de ORM sin reescribir la lógica de negocio.

### VIII. Pruebas guiadas por la especificación

- Cada escenario de aceptación de una spec MUST tener al menos una prueba que lo verifique.
- Los casos de uso MUST tener pruebas unitarias; los contratos (API y backend↔IA) MUST tener
  pruebas de contrato.
- La categorización MUST evaluarse contra un conjunto de frases reales en español colombiano
  antes de cambiar de modelo o umbral.

**Razón**: con un solo desarrollador, las pruebas son la única revisión constante del trabajo.

## Stack y restricciones técnicas

- **App móvil**: React Native con Expo y TypeScript, solo Android al inicio.
- **Backend principal**: Bun + TypeScript, Clean Architecture, autenticación propia con JWT
  (access y refresh token) y `bcrypt`, ORM Drizzle.
- **Microservicio de IA**: FastAPI (Python) con la API de Gemini para extracción y un encoder
  multilingüe ligero que corre en CPU para categorización.
- **Datos**: PostgreSQL (con pgvector para embeddings), Redis para caché y colas, Cloudflare R2
  para imágenes de metas.
- **Correo transaccional**: Resend, usado solo desde el backend principal para verificación de
  correo y recuperación de contraseña. El envío MUST estar detrás de una interfaz propia para poder
  cambiar de proveedor sin tocar los casos de uso.
- **Infraestructura**: Docker y Docker Compose; solo el backend principal se expone fuera de la
  red interna.
- **Prohibido sin enmienda**: agregar servicios o herramientas fuera de esta lista (por ejemplo
  Firebase, Supabase, MongoDB, una base vectorial aparte, otro proveedor de correo).
- **Simplicidad**: el proyecto lo construye una sola persona. Toda complejidad adicional MUST
  justificarse en la sección *Complexity Tracking* del plan; ante la duda, YAGNI.
- **Monetización**: todo es gratuito durante el prototipo, pero el diseño MUST permitir limitar
  el uso de IA por plan en el futuro.

## Flujo de desarrollo y puertas de calidad

- Todo trabajo sigue Spec Driven Development con Spec Kit: `/speckit-specify` →
  `/speckit-clarify` (si hay ambigüedad) → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-analyze` → `/speckit-implement`.
- Las specs viven en `specs/NNN-nombre-corto/` y describen el QUÉ y el POR QUÉ, sin detalles de
  implementación; los planes describen el CÓMO.
- Ninguna implementación empieza con marcadores `[NEEDS CLARIFICATION]` sin resolver.
- El plan de cada funcionalidad MUST pasar el *Constitution Check* contra estos principios.
- Si durante la implementación cambia un requisito, se actualiza primero la spec y luego el
  código.
- Contexto de referencia: `docs/vision-fase-0.md` (visión y alcance) y `docs/arquitectura.md`
  (arquitectura técnica).

## Governance

Esta constitución prevalece sobre cualquier otra práctica, plantilla o instrucción del
proyecto. Cuando un documento de `docs/` contradiga esta constitución, manda la constitución.

- **Enmiendas**: se proponen con `/speckit-constitution`, documentando el cambio en el Sync
  Impact Report y revisando qué specs y planes existentes quedan afectados.
- **Versionado** (semántico): MAJOR al eliminar o redefinir un principio; MINOR al agregar un
  principio o sección, o ampliar materialmente una guía; PATCH para aclaraciones de redacción.
- **Cumplimiento**: cada plan verifica la constitución en su *Constitution Check*;
  `/speckit-analyze` revisa la coherencia entre spec, plan y tareas antes de implementar.

**Version**: 1.1.1 | **Ratified**: 2026-10-22 | **Last Amended**: 2026-10-22
