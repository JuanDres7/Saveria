import type { Child } from 'hono/jsx';

/**
 * Marco de las páginas mínimas de los enlaces (FR-037). HTML con estilos inline y sin recursos
 * externos: la CSP de estas páginas solo permite estilos inline y enviar formularios al mismo
 * origen.
 */
export function Layout({ title, children }: { title: string; children: Child }) {
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
