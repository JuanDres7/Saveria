import type { Child } from 'hono/jsx';

/**
 * Páginas mínimas del enlace de verificación (FR-037). HTML con estilos inline y sin recursos
 * externos: la CSP de estas páginas solo permite estilos inline y enviar el formulario al mismo
 * origen.
 */
function Layout({ title, children }: { title: string; children: Child }) {
  return (
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} · Saveria</title>
      </head>
      <body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; color: #1d2433;">
        <h1 style="font-size: 1.5rem;">{title}</h1>
        {children}
      </body>
    </html>
  );
}

/** GET con un enlace vigente: muestra el botón; el token se consume solo al pulsarlo. */
export function ConfirmEmailPage({ token, action }: { token: string; action: string }) {
  return (
    <Layout title="Confirma tu correo">
      <p>Pulsa el botón para confirmar que este correo es tuyo.</p>
      <form method="post" action={action}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          style="font-size: 1rem; padding: 0.75rem 1.25rem; border: 0; border-radius: 0.5rem; background: #0f7a5c; color: #fff;"
        >
          Confirmar mi correo
        </button>
      </form>
    </Layout>
  );
}

export function EmailVerifiedPage() {
  return (
    <Layout title="Correo confirmado">
      <p>Listo: ya puedes volver a la app.</p>
    </Layout>
  );
}

/** Enlace vencido, usado, reemplazado por uno nuevo o desconocido: no se dice cuál de todos. */
export function InvalidVerificationLinkPage() {
  return (
    <Layout title="Este enlace no es válido">
      <p>
        El enlace no es válido: ya se usó, venció o pediste uno más nuevo. Abre la app y pide que te
        volvamos a enviar el correo con la opción de reenviar.
      </p>
    </Layout>
  );
}
