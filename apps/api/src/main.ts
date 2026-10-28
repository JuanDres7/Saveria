import { createApp } from './app';
import { createPurgeExpired, PURGE_INTERVAL_MS } from './application/use-cases/purge-expired';
import { configWarnings, loadConfig } from './config';
import { createContainer } from './container';

const config = loadConfig();
const container = createContainer(config);
const app = createApp(container);

// Bun pasa el servidor como segundo argumento de `fetch`; Hono lo usa para leer la IP del socket.
const server = Bun.serve({ port: config.PORT, fetch: app.fetch });
container.logger.info({ port: server.port, env: config.NODE_ENV }, 'api listening');
for (const warning of configWarnings(config)) container.logger.warn({ warning }, 'config warning');

// Limpieza diaria de sesiones y enlaces vencidos. Un fallo se registra y se reintenta mañana.
const purgeExpired = createPurgeExpired(container);
async function runPurge() {
  try {
    container.logger.info(await purgeExpired(), 'purge done');
  } catch (error) {
    container.logger.error(
      { reason: error instanceof Error ? error.message : 'unknown' },
      'purge failed',
    );
  }
}
void runPurge();
const purgeTimer = setInterval(() => void runPurge(), PURGE_INTERVAL_MS);

async function shutdown(signal: string) {
  container.logger.info({ signal }, 'shutting down');
  clearInterval(purgeTimer);
  await server.stop();
  await container.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
