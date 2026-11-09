import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EmailMessage, EmailSender } from '../../application/ports/services';

function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'correo'
  );
}

/** Desarrollo y pruebas: en vez de enviar el correo, lo guarda como archivo .html. */
export class DevOutboxEmailSender implements EmailSender {
  constructor(private readonly dir: string) {}

  async send(message: EmailMessage): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = join(this.dir, `${stamp}-${slugify(message.subject)}.html`);
    const header = `<!-- to: ${message.to} | subject: ${message.subject} -->\n`;
    await writeFile(file, header + message.html, 'utf-8');
  }
}
