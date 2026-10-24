import type { EmailMessage } from '../../../application/ports/services';

/**
 * Correo de recuperación de contraseña (FR-028). Solo lleva lo necesario para la acción: nunca
 * montos ni datos financieros (FR-036). HTML simple, sin imágenes ni recursos externos.
 */
export function resetPasswordMessage({ to, link }: { to: string; link: string }): EmailMessage {
  return {
    to,
    subject: 'Crea una contraseña nueva para Saveria',
    text: [
      'Hola:',
      '',
      'Pediste crear una contraseña nueva. Abre este enlace para hacerlo:',
      link,
      '',
      'El enlace vence en 30 minutos y sirve una sola vez.',
      'Si no lo pediste, ignora este mensaje: tu contraseña no cambia.',
    ].join('\n'),
    html: `<!doctype html>
<html lang="es">
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1d2433;">
    <p>Hola:</p>
    <p>Pediste crear una contraseña nueva. Abre este enlace para hacerlo:</p>
    <p><a href="${link}">Crear contraseña nueva</a></p>
    <p style="color: #5b6475;">Si el botón no funciona, copia esta dirección en el navegador:<br>${link}</p>
    <p style="color: #5b6475;">El enlace vence en 30 minutos y sirve una sola vez. Si no lo pediste, ignora este mensaje: tu contraseña no cambia.</p>
  </body>
</html>`,
  };
}
