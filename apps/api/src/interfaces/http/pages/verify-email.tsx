import { Layout } from './layout';

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
