# Saveria — Mapa de la app

> Fecha: 2026-11-09. Define **dónde vive cada módulo** del producto, incluidos los que aún no existen, para que el
> diseño no tenga que rehacerse cuando lleguen. No cambia el alcance ni el orden de las funcionalidades: eso lo
> mandan `docs/vision-fase-0.md` y la constitución. Maquetas: https://claude.ai/artifact/HeGUmjPATU7j8e3wmoWTfc
> (sección «Dónde va lo que viene»).

## Idea central

La visión dice que registrar debe costar lo mismo que mandar un mensaje y que la entrada conversacional es la forma
principal de registro, no una función escondida. Por eso el mapa reserva tres lugares para hablarle a Saveria (el
botón «+», una barra en Inicio y una pestaña propia) y deja el registro manual a un toque como respaldo.

## Las cinco piezas de la barra inferior

| Lugar | Qué responde | Qué contiene al final |
|---|---|---|
| **Inicio** | ¿Cómo voy? | Saludo, balance, barra para contarle a Saveria, «Por confirmar», «Este mes», cuentas, «Próximos», últimos movimientos |
| **Movimientos** | ¿Qué pasó? | Historial con filtros y una parte «Programados» para los recurrentes |
| **«+»** (centro) | Registrar | Una pantalla con dos puertas: «Contar» (relato para la IA) y «A mano» (formulario) |
| **Mi plata** | ¿Dónde está y para qué es? | Cuentas, Metas y Deudas |
| **Saveria** | Hablar con la IA | Una sola conversación: relatos, confirmación, modo automático con deshacer, preguntas y consejos |

Ajustes no es una sección de la barra en la versión final: se abre con un engranaje arriba en Inicio.

## La barra, paso a paso

El «+» y las dos primeras secciones no se mueven nunca. Solo cambian los dos lugares de la derecha.

| Momento | Barra | Qué cambia |
|---|---|---|
| Rediseño (feature 003) | Inicio, Movimientos, «+», Cuentas, Ajustes | Punto de partida. |
| Registro por IA (feature 004) | Inicio, Movimientos, «+», Cuentas, Saveria | Ajustes pasa al engranaje de Inicio; entra la conversación. |
| Metas y deudas (v2) | Inicio, Movimientos, «+», Mi plata, Saveria | Cuentas pasa a ser la primera parte de «Mi plata». |

## El lugar de cada módulo

| Módulo (visión) | Fase | Dónde vive |
|---|---|---|
| Gastos e ingresos manuales | MVP (hecho) | «+», puerta «A mano»; edición desde Movimientos |
| Cuentas y transferencias | MVP (hecho) | Sección Cuentas (luego «Mi plata»); «Transferir» en la tarjeta de balance y en el detalle de cada cuenta |
| Registro por IA (relato) | MVP | «+», puerta «Contar»; barra «Cuéntale tu día a Saveria» en Inicio; pestaña Saveria |
| Pantalla de confirmación | MVP | Dentro de la conversación: tarjeta «Entendí N cosas» con «Aceptar todo» y corrección en el mismo lugar. Inicio lo avisa en «Por confirmar» y la pestaña Saveria muestra un punto |
| Modo automático e historial con deshacer | MVP | La conversación muestra lo guardado con su «Deshacer»; en Movimientos la fila lleva la marca «por Saveria» |
| Cola de relatos sin conexión | MVP | El mensaje queda en la conversación como pendiente de enviar |
| Categorización y datos inferidos | MVP | Marca «sugerido» (tono arena) junto a la categoría, la cuenta o el monto que Saveria infirió |
| Sincronización entre dispositivos | MVP | Estado en Ajustes; los avisos de «no se pudo guardar» que ya existen |
| Resumen del mes | MVP | Bloque «Este mes» en Inicio, que abre la pantalla de resumen (saldo por cuenta y gasto por categoría) |
| Totales consolidados y monedas de referencia | MVP | En pequeño, debajo de la cifra del balance; se eligen en Ajustes, donde ya están |
| Movimientos recurrentes | v2 | Movimientos, parte «Programados»; bloque «Próximos» en Inicio; al generarse pasan por «Por confirmar» |
| Deudas | v2 | Mi plata, parte «Deudas»: lo que te deben y lo que debes, con sus abonos |
| Metas de ahorro | v2 | Mi plata, parte «Metas», con imagen, avance y abonos |
| Asistente de preguntas | v2 | Pestaña Saveria, en la misma conversación |
| Consejos con RAG | Futuro | Pestaña Saveria, con el aviso de que son educativos y no asesoría |
| Presupuestos por categoría | Futuro | Dentro del resumen del mes, como límite de cada categoría; las alertas, como aviso en Inicio |
| Notas de voz | Futuro | El micrófono que acompaña cada lugar donde se escribe un relato |
| Plan Pro y uso de la IA | Futuro | Ajustes, grupo «Tu plan»; el aviso de límite, junto a donde se escribe el relato |

## Orden de los bloques de Inicio

De arriba abajo. Cada bloque aparece solo cuando su función existe y tiene algo que mostrar; los demás no se mueven.

1. Saludo (y engranaje de Ajustes, desde la 004)
2. Aviso de correo sin verificar (ya existe)
3. Tarjeta de balance, con «Transferir» (y monedas de referencia, 008)
4. Barra «Cuéntale tu día a Saveria» (004)
5. «Por confirmar»: acciones propuestas por la IA (004) y recurrentes generados (v2)
6. «Este mes» (007)
7. Tus cuentas
8. «Próximos» (v2)
9. Últimos movimientos

## Registrar: dos puertas en una pantalla

- El «+» abre siempre la misma pantalla. Arriba hay un selector «Contar | A mano» (llega con la 004).
- La pantalla recuerda la última puerta usada. Así quien registra a mano conserva los 3 toques más el monto
  (principio 5 de la visión): «+», categoría, guardar.
- Las dos puertas terminan en el mismo caso de uso (Constitución I).

## Qué deja listo el rediseño (feature 003)

Solo estructura; nada de esto es visible ni agrega funciones:

- **Barra armada como una lista** de secciones, cada una con ícono, nombre, ruta y un punto de aviso opcional.
- **Inicio por bloques** en el orden de arriba; hoy solo existen 1, 2, 3, 7 y 9.
- **Registrar** con un encabezado propio donde irá el selector de las dos puertas.
- **Movimientos y Cuentas como contenedores**: la lista es una parte, de modo que «Programados», «Metas» y «Deudas»
  entren como partes nuevas.
- **Ajustes por grupos**, para que «Saveria», «Tu plan» y «Sincronización» entren como grupos.
- **Tono arena** reservado para la marca de dato sugerido.

## Cuándo se actualiza este documento

Cada funcionalidad nueva revisa este mapa en su plan. Si necesita un lugar distinto al previsto, se cambia primero
aquí y se explica por qué.
