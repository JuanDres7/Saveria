import { Layout } from './layout';

const fieldStyle =
  'display: block; width: 100%; box-sizing: border-box; font-size: 1rem; padding: 0.6rem; margin: 0.25rem 0 0.25rem; border: 1px solid #9ca3af; border-radius: 0.5rem;';
const errorStyle = 'color: #b91c1c; margin: 0 0 0.75rem; font-size: 0.9rem;';

/**
 * Formulario de contraseña nueva. El GET lo muestra sin consumir el token; si el POST trae datos
 * inválidos se vuelve a mostrar con los errores y el enlace sigue sirviendo.
 */
export function ResetPasswordPage({
  token,
  action,
  errors = {},
}: {
  token: string;
  action: string;
  errors?: { password?: string; passwordConfirmation?: string };
}) {
  return (
    <Layout title="Crea una contraseña nueva">
      <p>Mínimo 8 caracteres, con al menos una letra y un número.</p>
      <form method="post" action={action}>
        <input type="hidden" name="token" value={token} />
        <label for="password">Contraseña nueva</label>
        <input
          id="password"
          type="password"
          name="password"
          autocomplete="new-password"
          required
          style={fieldStyle}
        />
        {errors.password ? <p style={errorStyle}>{errors.password}</p> : null}
        <label for="passwordConfirmation">Repite la contraseña</label>
        <input
          id="passwordConfirmation"
          type="password"
          name="passwordConfirmation"
          autocomplete="new-password"
          required
          style={fieldStyle}
        />
        {errors.passwordConfirmation ? (
          <p style={errorStyle}>{errors.passwordConfirmation}</p>
        ) : null}
        <button
          type="submit"
          style="margin-top: 0.75rem; font-size: 1rem; padding: 0.75rem 1.25rem; border: 0; border-radius: 0.5rem; background: #0f7a5c; color: #fff;"
        >
          Guardar contraseña
        </button>
      </form>
    </Layout>
  );
}

export function PasswordResetDonePage() {
  return (
    <Layout title="Contraseña actualizada">
      <p>
        Listo. Ya puedes entrar en la app con tu contraseña nueva. Por seguridad cerramos la sesión
        en todos tus dispositivos.
      </p>
    </Layout>
  );
}

/** Enlace vencido, usado, reemplazado por uno nuevo o desconocido (escenario 5.5). */
export function InvalidResetLinkPage() {
  return (
    <Layout title="Este enlace no es válido">
      <p>
        El enlace no es válido: ya se usó, venció o pediste uno más nuevo. Pide otro en la app con
        la opción "Olvidé mi contraseña".
      </p>
    </Layout>
  );
}
