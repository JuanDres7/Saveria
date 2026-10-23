# Spike: Drizzle + expo-sqlite con SQLCipher

**Fecha**: 2026-10-22 | **Feature**: 001-auth-onboarding | **Resultado**: ✅ 7/7

## Pregunta

¿Funciona Drizzle ORM sobre una base de expo-sqlite cifrada con SQLCipher en Android, incluidas
las migraciones y las transacciones?

## Entorno

- Expo SDK 58.0.17, React Native 0.88.0, expo-sqlite 58.0.13 (`useSQLCipher: true`),
  drizzle-orm 0.45.4.
- Compilación local con Gradle, **JDK 21** (`C:\Program Files\Java\jdk-21`) y Android SDK en
  `C:\src\Android\Sdk`. Primera compilación: unos 8 min.
- Emulador Android 16 (API 36, x86_64, `saveria_spike`), con aceleración WHPX.

## Resultados ([resultado.png](resultado.png))

| # | Comprobación | Resultado |
|---|---|---|
| 1 | SQLCipher activo, migración de Drizzle y dos inserts en una transacción | PASS: `cipher_version=4.17.0 community` |
| 2 | Rollback de una transacción de Drizzle | PASS |
| 3 | El archivo no tiene la cabecera `SQLite format 3` | PASS |
| 4 | Control: una base sin clave sí la tiene (valida la #3) | PASS |
| 5 | Con la clave equivocada no se puede leer | PASS: `file is not a database` |
| 6 | Sin clave no se puede leer | PASS: `file is not a database` |
| 7 | Al reabrir con la clave correcta se conservan los datos | PASS |

Verificación independiente con `adb run-as`:

- El archivo cifrado empieza con bytes aleatorios y el texto `Barranquilla` no aparece en él.
- La base de control empieza con `SQLite format 3\0`.

## Patrón confirmado

```ts
const conn = SQLite.openDatabaseSync(nombre);
if (conn.getFirstSync('PRAGMA cipher_version') == null) throw new Error('sin SQLCipher');
conn.execSync(`PRAGMA key = "x'${claveHex}'"`); // clave de 32 bytes en hex
const db = drizzle(conn);
await migrate(db, migrations);
```

## Hallazgos para el plan

- **Funciona**: no hace falta el plan B de escribir SQL a mano.
- **JDK 21 sirve**: no hay que instalar JDK 17. Basta con apuntar `JAVA_HOME` a `jdk-21`; Java 25
  no se probó.
- En `android/local.properties` la ruta del SDK debe ir con `/` (`C:/src/Android/Sdk`). Con `\`
  sin escapar, Gradle falla con "la sintaxis del nombre de archivo no es correcta".
- Para leer archivos en SDK 58 se usa la API nueva (`File`, `Paths`); la API `legacy` falló con
  rutas de la base.
- Si Metro sirve código viejo, se reinicia con `expo start --clear`.

## Cómo repetirlo

```powershell
cd spikes/sqlcipher-drizzle
bun install
bunx expo prebuild --platform android
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
cd android; ./gradlew assembleDebug; cd ..
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
bunx expo start --dev-client   # y abrir la app en el emulador
```
