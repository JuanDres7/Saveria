import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EmailMessage, EmailSender } from '../../src/application/ports/services';
import { DevOutboxEmailSender } from '../../src/infrastructure/email/dev-outbox-sender';
import { ResilientEmailSender } from '../../src/infrastructure/email/resilient-email-sender';
import { createLogger } from '../../src/infrastructure/logging/logger';

const message: EmailMessage = {
  to: 'ana@mail.com',
  subject: 'Confirma tu correo',
  html: '<p>Hola, confirma aquí: https://saveria.test/links/verify-email?token=SECRETO</p>',
  text: 'Hola',
};

describe('DevOutboxEmailSender', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'saveria-outbox-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('guarda el correo como archivo .html con el destinatario y el asunto', async () => {
    await new DevOutboxEmailSender(dir).send(message);
    const files = await readdir(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.*-confirma-tu-correo\.html$/);
    const content = await readFile(join(dir, files[0] ?? ''), 'utf-8');
    expect(content).toContain('to: ana@mail.com');
    expect(content).toContain('token=SECRETO');
  });
});

describe('ResilientEmailSender', () => {
  function flaky(failures: number) {
    const calls: EmailMessage[] = [];
    const inner: EmailSender = {
      send: async (m) => {
        calls.push(m);
        if (calls.length <= failures) throw new Error('proveedor caído');
      },
    };
    return { inner, calls };
  }

  const noSleep = async () => {};

  it('vuelve de inmediato sin esperar la entrega', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let delivered = false;
    const inner: EmailSender = {
      send: async () => {
        await gate;
        delivered = true;
      },
    };
    const sender = new ResilientEmailSender(inner, createLogger('silent'), [], noSleep);
    await sender.send(message);
    expect(delivered).toBe(false);
    release();
    await sender.flush();
    expect(delivered).toBe(true);
  });

  it('reintenta con espera de 1 s, 5 s y 30 s hasta que el envío funciona', async () => {
    const { inner, calls } = flaky(2);
    const sleeps: number[] = [];
    const sender = new ResilientEmailSender(
      inner,
      createLogger('silent'),
      undefined,
      async (ms) => {
        sleeps.push(ms);
      },
    );
    await sender.send(message);
    await sender.flush();
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([1_000, 5_000]);
  });

  it('se rinde después de 3 reintentos y no lanza error', async () => {
    const { inner, calls } = flaky(100);
    const sleeps: number[] = [];
    const sender = new ResilientEmailSender(
      inner,
      createLogger('silent'),
      undefined,
      async (ms) => {
        sleeps.push(ms);
      },
    );
    await sender.send(message);
    await expect(sender.flush()).resolves.toBeUndefined();
    expect(calls).toHaveLength(4);
    expect(sleeps).toEqual([1_000, 5_000, 30_000]);
  });

  it('no registra el contenido del correo ni el destinatario al fallar', async () => {
    const lines: string[] = [];
    const logger = createLogger('info', { write: (line: string) => void lines.push(line) });
    const { inner } = flaky(100);
    const sender = new ResilientEmailSender(inner, logger, [0], noSleep);
    await sender.send(message);
    await sender.flush();
    const output = lines.join('');
    expect(output).toContain('email delivery failed');
    expect(output).not.toContain('SECRETO');
    expect(output).not.toContain('ana@mail.com');
  });
});
