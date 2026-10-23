import { PRIVACY_POLICY_PATH, PRIVACY_POLICY_VERSION } from '@saveria/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../context';

/**
 * Texto PROVISIONAL de la política de tratamiento de datos (FR-005). Cubre lo mínimo que pide la
 * spec; el texto definitivo lo debe revisar un abogado antes de publicar la app.
 */
function PrivacyPolicyPage() {
  return (
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Política de tratamiento de datos · Saveria</title>
      </head>
      <body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5;">
        <h1>Política de tratamiento de datos</h1>
        <p>Versión {PRIVACY_POLICY_VERSION}</p>

        <h2>Qué datos recogemos</h2>
        <p>
          Tu correo electrónico, tu contraseña (guardada solo como un hash que no se puede
          revertir), las preferencias que eliges en la app (nombre para la IA, país, ciudad, monedas
          y modo de la IA) y la información financiera que registras: cuentas y movimientos.
        </p>

        <h2>Para qué usamos tu país y tu ciudad</h2>
        <p>
          Para sugerirte la moneda principal y para dar contexto a la inteligencia artificial cuando
          interpreta tus relatos (por ejemplo, precios y costumbres locales). No los usamos para
          publicidad ni los vendemos.
        </p>

        <h2>Procesamiento de relatos con inteligencia artificial</h2>
        <p>
          Cuando cuentas un gasto o un ingreso con tus palabras, ese texto se envía a un proveedor
          externo de inteligencia artificial para convertirlo en movimientos. Solo se envía lo
          necesario para interpretar el relato.
        </p>

        <h2>Dónde se guardan tus datos</h2>
        <p>
          En nuestro servidor y en tu teléfono, en una base de datos cifrada. Al cerrar sesión los
          datos de tu teléfono se conservan cifrados para que puedas volver a entrar.
        </p>

        <h2>Cómo borrar tus datos</h2>
        <p>
          En la app, entra a Configuración y elige "Borrar mi cuenta". Se borran tu cuenta y todos
          tus datos del servidor y de tu teléfono. Esta acción no se puede deshacer.
        </p>
      </body>
    </html>
  );
}

export interface LegalRoutesDeps {
  publicBaseUrl: string;
}

export function legalRoutes({ publicBaseUrl }: LegalRoutesDeps) {
  const app = new Hono<AppEnv>();
  const url = new URL(PRIVACY_POLICY_PATH, publicBaseUrl).toString();

  app.get('/v1/legal/privacy-policy', (c) => c.json({ version: PRIVACY_POLICY_VERSION, url }));
  app.get(PRIVACY_POLICY_PATH, (c) => c.html(<PrivacyPolicyPage />));

  return app;
}
