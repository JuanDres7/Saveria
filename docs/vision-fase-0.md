# Saveria — Fase 0: Visión y alcance del MVP

> Fuente: documento "Saveria — Fase 0" en claude.ai. Fecha: 2026-10-22. Ante cualquier conflicto, manda `.specify/memory/constitution.md`.

## Problema

Registrar gastos en las apps de finanzas actuales cuesta demasiados pasos, así que la gente deja de hacerlo a los pocos días. Saveria nace de esa experiencia: al empezar a trabajar y manejar más dinero, llevar el control diario se volvió difícil y ninguna app de Google Play resultó cómoda.

El problema no es la falta de funciones (todas registran gastos, ingresos, metas y deudas), sino la fricción de cada registro. Si anotar un gasto toma más de unos segundos, el hábito se rompe y los datos dejan de servir.

## Propuesta de valor y usuario objetivo

**Registrar tus finanzas debe costar lo mismo que mandar un mensaje.** El usuario le cuenta su día a la IA y Saveria convierte el relato en gastos, ingresos, deudas, recurrentes y metas, ya categorizados. El registro manual existe como respaldo y para corregir.

**Usuario objetivo inicial:** personas jóvenes en Colombia que empiezan a tener ingresos propios (primer empleo, estudiantes que trabajan) y quieren control sin volverse expertos en finanzas.

**Diferenciadores frente a las apps actuales:**

- Entrada conversacional como forma principal de registro, no como función escondida.
- Una sola frase puede generar varias acciones de distintos módulos.
- Asistente que responde preguntas y da consejos basados en los datos del propio usuario.
- Pensada para Colombia: pesos colombianos y cuentas como Nequi, Daviplata o Bancolombia.

## Principios

Cinco reglas guían todas las decisiones de producto y de arquitectura.

1. **Dos puertas, un solo camino.** Cada módulo tiene formulario manual y entrada por IA, y ambos ejecutan el mismo caso de uso del backend. No se duplica lógica.
2. **La IA propone, el usuario confirma.** Gemini nunca escribe en la base de datos. Devuelve una lista de acciones propuestas con su tipo y datos; por defecto el usuario las revisa en una pantalla de confirmación. En modo automático, que el usuario activa en configuración, todas las acciones se guardan directo, incluidas deudas, metas y recurrentes, pero quedan en un historial con opción de deshacer.
3. **La pantalla de confirmación es la pantalla más importante.** Debe permitir aceptar todo con un toque y corregir un campo sin salir de ella.
4. **Offline primero.** Todo registro manual funciona sin red. Los relatos para la IA quedan en cola local hasta que haya conexión.
5. **Menos pasos que la competencia.** Cada flujo nuevo se mide en toques; si un registro manual pasa de tres toques más el monto, se rediseña.

Ejemplo de relato con varias acciones: *"hoy almorcé por 18 mil con Nequi, le presté 50 mil a Carlos y quiero ahorrar 2 millones para un PC"* produce un gasto, una deuda a favor y una meta.

> Diagrama: Relato → Gemini (propone acciones) → Confirmación (el usuario revisa) → **Caso de uso**; Formulario manual → **Caso de uso** (sin IA); Caso de uso → Base de datos (local, luego sync).

El relato pasa por Gemini y por la confirmación; el formulario va directo. Ambos llegan al mismo caso de uso antes de tocar la base de datos.

## Alcance por módulo

El MVP es un registro rápido de gastos e ingresos, manual y por IA, que funciona offline y separa el dinero por cuentas. Deudas, recurrentes y metas llegan en v2, cada una con su formulario y su tipo de acción para la IA al mismo tiempo.

| Módulo | Fase | Qué incluye |
| --- | --- | --- |
| Autenticación | MVP | Registro, login con JWT y refresh token, borrar cuenta |
| Onboarding y configuración | MVP | Nombre para la IA, país, ciudad, moneda principal, modo de la IA |
| Gastos e ingresos manuales | MVP | Crear, editar y eliminar; fecha, monto, categoría, cuenta |
| Categorías | MVP | Lista fija predefinida de gastos e ingresos, sin personalizadas |
| Cuentas manuales | MVP | Efectivo, Nequi, banco; cada una con su moneda, saldo inicial y transferencias |
| Registro por IA | MVP | Relato de texto, acciones propuestas, modo manual por defecto y modo automático opcional |
| Categorización en capas | MVP | Memoria por usuario, caché en Redis, encoder y Gemini como respaldo |
| Offline y sincronización | MVP | Base local, cola de cambios y de relatos, sync por UUID |
| Resumen del mes | MVP | Saldo por cuenta y gasto por categoría |
| Deudas | v2 | A favor y en contra, abonos, manual y por IA |
| Movimientos recurrentes | v2 | Frecuencia, próximo cobro, confirmación al generarse |
| Metas de ahorro | v2 | Monto objetivo, abonos, imagen en Cloudflare R2 |
| Asistente de preguntas | v2 | Preguntas sobre los propios datos ("¿cuánto gasté en comida?") |
| Consejos con RAG | Futuro | Base curada de contenido de finanzas personales |
| Presupuestos por categoría | Futuro | Límite mensual y alertas |
| Notas de voz | Futuro | Dictar el relato en vez de escribirlo |
| Plan Pro | Futuro | Límites de uso de IA y funciones avanzadas |
| iOS | Futuro | Publicación en App Store |

## Cuentas sin conexión al banco

Las cuentas son contenedores manuales: el usuario crea "Efectivo", "Nequi" o "Bancolombia" con un saldo inicial, y el saldo se calcula a partir de sus movimientos. No hay integración bancaria.

- **Toda transacción pertenece a una cuenta.** Al registrarse, el usuario recibe una cuenta "Efectivo" por defecto, así nadie queda bloqueado.
- **La IA infiere la cuenta** cuando el relato la menciona ("pagué con Nequi"); si no, usa la cuenta por defecto y el usuario la cambia en la confirmación.
- **Transferencias entre cuentas** ("pasé 100 mil de Bancolombia a Nequi") son un tipo de movimiento propio: no cuentan como gasto ni como ingreso.
- **Ajuste de saldo:** si el saldo real no cuadra, el usuario lo corrige y se registra un movimiento de ajuste, sin editar el historial.
- **Bolsillos** (dinero apartado dentro de una cuenta, como en Nequi) quedan para después; las metas de ahorro cubren buena parte de esa necesidad.

Incluir `accounts` en el esquema desde el MVP es clave: agregarla después obliga a migrar todas las transacciones existentes.

## Onboarding, configuración y multimoneda

Al registrarse, el usuario responde un onboarding corto y todo lo que elige se puede cambiar después en Configuración.

1. Cómo quiere que la IA lo llame.
2. País y ciudad.
3. Moneda principal, sugerida según el país.
4. Modo de la IA: manual (confirma cada acción) o automático. Viene en manual por defecto.

**Multimoneda:**

- Cada cuenta tiene su propia moneda (código ISO 4217: COP, USD, EUR). Una transacción usa siempre la moneda de su cuenta.
- Los montos se guardan como `DECIMAL` junto al código de moneda, nunca como número de punto flotante.
- Una transferencia entre cuentas de distinta moneda registra el monto que sale y el que entra, sin calcular la tasa.

**Cómo se ve el dinero:** todo el resumen se muestra consolidado en la moneda principal. El usuario puede activar en configuración monedas de referencia (por ejemplo USD) que aparecen al lado, en pequeño.

- Cada movimiento guarda su monto y moneda originales; la conversión se calcula al mostrar, no se guarda como dato principal.
- Para los reportes históricos se usa la tasa del día del movimiento, no la de hoy. Si no, el gasto de un mes pasado cambiaría cada vez que se mueve el dólar.
- Las tasas se descargan una vez al día desde una fuente externa y se guardan en una tabla `exchange_rates` en PostgreSQL, con caché en Redis. La app nunca consulta la fuente directamente.

**Datos personales:** país y ciudad se piden porque sirven para sugerir la moneda y dar contexto a la IA. La política de tratamiento de datos debe decir eso mismo.

La tabla `users` necesita campos nuevos: nombre para la IA, país, ciudad, moneda principal y modo de la IA.

## Categorías fijas

Saveria arranca con 18 categorías de gastos y 8 de ingresos, pensadas para Colombia y sin categorías personalizadas. Cada una lleva un identificador estable (`slug`) independiente del nombre visible, para poder renombrarla o traducirla sin migrar datos.

**Gastos**

| Categoría | Slug | Ejemplos para el encoder |
| --- | --- | --- |
| Mercado | `groceries` | mercado, supermercado, D1, Ara, Éxito, tienda del barrio |
| Restaurantes y domicilios | `dining` | almuerzo, corrientazo, comida rápida, Rappi, café, onces |
| Transporte | `transport` | bus, Transmetro, taxi, Uber, DiDi, mototaxi, pasaje |
| Vehículo | `vehicle` | gasolina, parqueadero, peaje, SOAT, taller, lavada de la moto |
| Vivienda | `housing` | arriendo, administración, cuota de la casa, reparaciones |
| Servicios del hogar | `utilities` | luz, agua, gas, internet, plan de celular, recarga |
| Salud | `health` | droguería, medicamentos, cita médica, odontólogo, exámenes |
| Cuidado personal | `personal_care` | peluquería, barbería, gimnasio, cosméticos, aseo personal |
| Educación | `education` | matrícula, curso, libros, fotocopias, útiles |
| Suscripciones | `subscriptions` | Netflix, Spotify, YouTube Premium, iCloud, ChatGPT |
| Entretenimiento | `entertainment` | cine, rumba, concierto, videojuegos, partido |
| Ropa y compras | `shopping` | ropa, zapatos, tecnología, celular, accesorios |
| Hogar y familia | `home_family` | muebles, electrodomésticos, aporte a la casa, hijos |
| Mascotas | `pets` | concentrado, veterinario, vacunas, arena |
| Regalos y donaciones | `gifts` | regalo, cumpleaños, ofrenda, donación, vaca |
| Viajes | `travel` | tiquete, hotel, Airbnb, paseo, vacaciones |
| Impuestos y trámites | `fees_taxes` | 4x1000, cuota de manejo, comisión, multa, pasaporte, predial |
| Otros gastos | `other_expense` | cualquier gasto que no encaje en las anteriores |

**Ingresos**

| Categoría | Slug | Ejemplos para el encoder |
| --- | --- | --- |
| Salario | `salary` | sueldo, quincena, nómina, pago del mes |
| Primas y bonos | `bonus` | prima, bonificación, comisión de ventas, cesantías |
| Trabajo independiente | `freelance` | honorarios, proyecto, cliente me pagó, cuenta de cobro |
| Ventas y negocio | `business` | vendí, ventas del día, emprendimiento |
| Rendimientos | `investments` | intereses, CDT, rendimientos, dividendos |
| Apoyos y regalos | `gifts_received` | mesada, me regalaron, apoyo de la familia |
| Reembolsos | `refunds` | devolución, reembolso, me devolvieron |
| Otros ingresos | `other_income` | cualquier ingreso que no encaje en las anteriores |

Tres tipos de movimiento **no llevan categoría** porque no son gasto ni ingreso: transferencias entre cuentas, abonos a deudas y abonos a metas. Cada uno vive en su propio módulo.

Cada categoría necesita entre 15 y 30 frases de ejemplo reales para que el encoder la reconozca bien; las de esta tabla son el punto de partida.

## Categorización en capas y aprendizaje

La mayoría de movimientos se categorizan sin llamar a Gemini: una cadena de capas resuelve primero con lo más rápido y barato, y solo escala cuando la capa anterior no está segura.

Hay dos tareas distintas. **Extraer** es separar un relato en movimientos (concepto, cantidad, monto, cuenta). **Categorizar** es asignar la categoría. El encoder solo categoriza; un relato largo con varias acciones sigue necesitando a Gemini para extraer. Una entrada corta como "bus 3700" se extrae con un parser simple, sin Gemini.

Capas de categorización, en orden:

1. **Memoria del usuario** (PostgreSQL): conceptos que el usuario ya confirmó, con su categoría y último precio unitario. "bus" responde Transporte y 3.700 al instante.
2. **Caché global** (Redis): concepto normalizado y su categoría, compartido entre usuarios. Solo guarda categorías, nunca montos.
3. **Encoder** (FastAPI): un modelo multilingüe de embeddings compara el concepto con frases de ejemplo de cada categoría, guardadas en pgvector. Si la similitud supera un umbral, asigna la categoría.
4. **Gemini:** solo cuando el encoder no llega al umbral, o cuando la categoría ya viene en la extracción de un relato.

**Cómo aprende sin ser costoso:**

- No se entrena ni se ajusta ningún modelo. "Aprender" es guardar lo que el usuario confirma o corrige: filas en una tabla y embeddings.
- Ejemplo: "me gasté 2 pasajes de bus" se extrae como concepto bus, cantidad 2, sin monto. La memoria completa 2 × 3.700 = 7.400 y la confirmación lo muestra marcado como monto inferido.
- Los precios se aprenden por usuario, nunca globales: el pasaje cuesta distinto en cada ciudad y compartir montos expondría datos de otros usuarios.
- Las correcciones de un usuario se vuelven ejemplos del encoder solo para ese usuario. Los ejemplos globales los cura el equipo, para que nadie pueda dañar la categorización de todos.
- Modelos candidatos para el encoder: `multilingual-e5-small` o `paraphrase-multilingual-MiniLM-L12-v2`, ambos livianos y en CPU. Se eligen con un conjunto de prueba de frases reales en español colombiano.

La lista fija de categorías ayuda: el encoder funciona mejor cuando las opciones son pocas, estables y cada una tiene buenas frases de ejemplo.

## Asistente y consejos con RAG

El asistente responde dos tipos de preguntas muy distintas, y cada una necesita una técnica diferente.

| Tipo de pregunta | Ejemplo | Técnica |
| --- | --- | --- |
| Sobre los datos del usuario | "¿Cuánto gasté en comida este mes?" | Function calling: Gemini llama funciones del backend que consultan PostgreSQL. No es RAG. |
| Consejo general | "¿Cómo armo un fondo de emergencia?" | RAG sobre una base curada de documentos de finanzas personales |
| Consejo personalizado | "¿Cómo puedo ahorrar más?" | Ambas: datos del usuario más documentos recuperados |

- **El valor real está en los datos propios.** Un consejo genérico lo da cualquier chatbot; uno que dice "gastas 35% en domicilios" solo lo da Saveria. Por eso las preguntas sobre datos van antes que el RAG.
- **Vectores en PostgreSQL con pgvector.** Es una extensión de la base que ya está en el stack, así que no hace falta agregar una base vectorial aparte.
- **Contenido de la base:** material propio o con licencia que permita reutilizarlo. Copiar artículos de terceros sin permiso es un riesgo legal.
- **Aviso visible:** las respuestas son educativas y no constituyen asesoría financiera profesional.
- **Costo:** cada pregunta es una llamada a Gemini. Esta función es la candidata natural a tener límite en el plan gratuito.

## Restricciones

Saveria se construye por una sola persona, solo para Android al inicio, gratis durante el prototipo y con usuarios reales como meta.

- **Desarrollador único.** El alcance del MVP tiene que caber en el tiempo de una persona que también estudia. Cualquier función nueva entra a v2 salvo que reemplace otra del MVP.
- **Infraestructura liviana.** Cuatro contenedores (Bun, FastAPI, PostgreSQL, Redis) son manejables, pero cada uno es algo más que mantener. El encoder de categorización corre en el contenedor de FastAPI con un modelo multilingüe pequeño en CPU, sin GPU.
- **Solo Android.** Expo permite iOS después sin reescribir. Google Play pide una cuenta de desarrollador y, para cuentas personales nuevas, una prueba cerrada con testers antes de publicar en producción (verificar los requisitos vigentes).
- **Freemium a futuro.** Todo es gratis en el prototipo, pero desde ya se registra cuántas llamadas a la IA hace cada usuario, para conocer el costo real y definir los límites del plan gratuito.
- **Datos personales (Ley 1581 de 2012).** Se necesita política de tratamiento de datos, autorización explícita al registrarse, informar que los relatos se procesan con un proveedor externo (Google) y permitir borrar la cuenta y sus datos.
- **Términos de Gemini.** Revisar qué hace Google con los datos enviados en el nivel gratuito frente al de pago antes de abrir la app a usuarios reales.

## Metodología: Spec Driven Development

Con SDD la especificación es la fuente de la verdad y el código se genera y se verifica contra ella. Encaja bien con un desarrollador único que trabaja con IA: las specs le dan a Claude contexto exacto en cada sesión y evitan que las decisiones queden solo en el chat.

Cada funcionalidad recorre estos pasos:

1. **Constitución** (una sola vez): principios, stack y reglas no negociables. Este documento y el de arquitectura son su base.
2. **Spec:** qué hace la funcionalidad y por qué, historias de usuario y criterios de aceptación. Sin detalles técnicos.
3. **Plan técnico:** modelo de datos, endpoints, contratos JSON y decisiones de arquitectura de esa funcionalidad.
4. **Tareas:** el plan dividido en pasos pequeños y verificables.
5. **Implementación:** se programa tarea por tarea, con pruebas derivadas de los criterios de aceptación.
6. **Verificación:** se revisa el resultado contra la spec; si algo cambió, se actualiza la spec primero.

Estructura sugerida en el repositorio: una carpeta `specs/` con una subcarpeta por funcionalidad (`001-auth/`, `002-transacciones/`…), cada una con `spec.md`, `plan.md` y `tasks.md`. Herramientas como Spec Kit de GitHub automatizan este flujo, pero no son obligatorias.

Las fases de planeación quedan así: Fase 0 produce la constitución, Fase 1 las specs, Fases 3 y 4 los planes técnicos y Fase 5 las tareas.

## Decisiones y siguientes pasos

Nueve decisiones quedaron cerradas el 22 de octubre de 2026:

| Decisión | Resultado |
| --- | --- |
| Fecha objetivo | Sin fecha; proyecto personal que avanza a su ritmo |
| Moneda | Multimoneda desde el inicio; moneda principal elegida en el onboarding |
| Visualización de montos | Todo consolidado en la moneda principal, con monedas de referencia opcionales al lado |
| Tasas de cambio | Fuente externa, descarga diaria, tasa del día de cada movimiento |
| Confirmación de la IA | Modo manual por defecto; modo automático opcional desde configuración |
| Alcance del modo automático | Todas las acciones, incluidas deudas, metas y recurrentes |
| Categorías | Lista fija de 18 de gastos y 8 de ingresos, sin personalizadas |
| ORM | Drizzle |
| Categorización | En capas, con encoders y memoria de conceptos por usuario |

Siguen abiertas:

- ¿Qué fuente de tasas de cambio? Candidatas: la TRM oficial para COP/USD y una API de tasas para el resto de monedas. Se decide en la Fase 3.

Siguientes pasos:

- [ ] Revisar y ajustar la tabla de alcance
- [ ] Revisar la lista de categorías propuesta
- [ ] Ampliar a 15–30 frases de ejemplo por categoría
- [ ] Convertir este documento y el de arquitectura en la constitución del proyecto
- [ ] Escribir las specs del MVP (Fase 1), empezando por autenticación, onboarding y transacciones manuales
- [ ] Bocetar la pantalla de confirmación de la IA (Fase 2)
