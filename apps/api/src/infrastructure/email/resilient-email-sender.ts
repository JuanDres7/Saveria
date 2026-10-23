import type { EmailMessage, EmailSender } from '../../application/ports/services';
import type { Logger } from '../logging/logger';

const DEFAULT_RETRY_DELAYS_MS = [1_000, 5_000, 30_000];

/**
 * Envía en segundo plano: `send` vuelve de inmediato, así un proveedor lento o caído no retrasa ni
 * rompe el registro. Reintenta 3 veces (1 s, 5 s, 30 s). Nunca registra el contenido del correo.
 */
export class ResilientEmailSender implements EmailSender {
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly inner: EmailSender,
    private readonly logger: Logger,
    private readonly retryDelaysMs: number[] = DEFAULT_RETRY_DELAYS_MS,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const task = this.deliver(message).finally(() => this.pending.delete(task));
    this.pending.add(task);
  }

  /** Espera a que terminen los envíos en curso (apagado ordenado y pruebas). */
  async flush(): Promise<void> {
    await Promise.all([...this.pending]);
  }

  private async deliver(message: EmailMessage): Promise<void> {
    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt++) {
      try {
        await this.inner.send(message);
        return;
      } catch (error) {
        const retriesLeft = this.retryDelaysMs.length - attempt;
        this.logger.warn(
          { reason: error instanceof Error ? error.message : 'unknown', retriesLeft },
          'email delivery failed',
        );
        const delay = this.retryDelaysMs[attempt];
        if (delay === undefined) return;
        await this.sleep(delay);
      }
    }
  }
}
