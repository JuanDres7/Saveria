import { Resend } from 'resend';
import type { EmailMessage, EmailSender } from '../../application/ports/services';

export class ResendEmailSender implements EmailSender {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    // El SDK devuelve el error en vez de lanzarlo. Solo se propaga su tipo, nunca el contenido.
    if (error) throw new Error(`Resend: ${error.name}`);
  }
}
