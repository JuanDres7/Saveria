import type { EmailMessage } from '../../../application/ports/services';

/**
 * Correo de verificación (FR-031). Solo lleva lo necesario para la acción: nunca montos ni datos
 * financieros (FR-036). HTML simple, sin imágenes ni recursos externos.
 */
export function verifyEmailMessage({ to, link }: { to: string; link: string }): EmailMessage {
  return {
    to,
    subject: 'Confirma tu correo en Saveria',
    text: [
      'Hola:',
      '',
      'Para confirmar que este correo es tuyo, abre este enlace:',
      link,
      '',
      'El enlace vence en 24 horas y sirve una sola vez.',
      'Si no creaste una cuenta en Saveria, ignora este mensaje.',
    ].join('\n'),
    html: `<!doctype html>
<html lang="es">
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1d2433;">
    <p>Hola:</p>
    <p>Para confirmar que este correo es tuyo, abre este enlace:</p>
    <p><a href="${link}">Confirmar mi correo</a></p>
    <p style="color: #5b6475;">Si el botón no funciona, copia esta dirección en el navegador:<br>${link}</p>
    <p style="color: #5b6475;">El enlace vence en 24 horas y sirve una sola vez. Si no creaste una cuenta en Saveria, ignora este mensaje.</p>
  </body>
</html>`,
  };
}
