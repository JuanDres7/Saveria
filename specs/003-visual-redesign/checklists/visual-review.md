# Revisión visual de la 003

Registro de lo que se revisa en el emulador (`saveria_spike`, 1080×2400, 420 dpi) en modo claro y oscuro, y de la aprobación del
dueño del proyecto por grupo de pantallas (SC-008). Las capturas se guardan fuera del repositorio.

## Base del tema (T024), 2026-11-10

Se reconstruyó la app de desarrollo (`expo prebuild` + Gradle `assembleDebug`, solo x86_64, 3 min 34 s) porque cambian cosas
nativas: `react-native-svg`, la letra incrustada y la pantalla de arranque.

| Comprobación | Resultado |
|---|---|
| La compilación recoge la letra | `MainApplication.kt` registra la familia `BricolageGrotesque` (pesos 600 y 700) con el plugin de `expo-font`. Sin carga en ejecución. |
| Título en la letra de identidad | La bienvenida muestra «Bienvenido a Saveria» en Bricolage Grotesque Bold, y el texto corrido en la letra del sistema. |
| Arranque en frío, modo claro | Tres capturas a 0,4 s, 0,8 s y 1,2 s del arranque: todas en crema `#F6F3EA`. Sin destello blanco ni azul. |
| Arranque en frío, modo oscuro | Las mismas tres capturas: todas en `#14180F`. Sin destello blanco. |
| Cambio de modo con la app abierta | `adb shell cmd uimode night yes` cambia el fondo y la barra de estado al instante, sin cerrar la app. |
| Forma de fondo | La forma orgánica `sage` aparece arriba a la derecha en los dos modos y no tapa texto. |
| Cifras tabulares de la letra | **Pendiente**: la bienvenida no tiene cifras. Se comprueba en Inicio (T032) con la cifra del balance. |

### Lo que se ve «a medias» a propósito

La bienvenida todavía no se migra (es la tarea T039 de la historia 3). Por eso, en modo oscuro, el texto corrido y «Ya tengo cuenta»
aparecen casi invisibles: esas dos piezas aún usan colores fijos de antes del rediseño. Pasa en todas las pantallas sin migrar y
desaparece al migrarlas en su historia.

El engranaje redondo arriba a la derecha es el botón «Tools» de la app de desarrollo de Expo, no forma parte de Saveria.
