import type { OutboxItem, Sender, SendResult } from './outbox';

/**
 * Lo que guarda cada cambio del outbox para poder enviarse: la petición HTTP tal cual.
 * Las features que encolan cambios (perfil, onboarding, movimientos) arman este payload.
 */
export interface HttpPayload {
  method: 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
}

function isHttpPayload(payload: unknown): payload is HttpPayload {
  const p = payload as Partial<HttpPayload> | null;
  return typeof p?.method === 'string' && typeof p.path === 'string' && p.path.startsWith('/');
}

/**
 * Envía un cambio del outbox con el `fetch` autenticado del cliente (que renueva la sesión ante
 * un 401). Decide qué hacer con la respuesta:
 * - 2xx: enviado.
 * - 401, 429, 5xx o sin red: pasajero, se reintenta.
 * - otro 4xx (por ejemplo 409: el servidor tiene una versión más nueva): no tiene arreglo, se
 *   descarta para no bloquear la cola.
 */
export function createHttpSender(
  authFetch: (request: Request) => Promise<Response>,
  baseUrl: string,
): Sender {
  return async (item: OutboxItem): Promise<SendResult> => {
    if (!isHttpPayload(item.payload)) return { status: 'discard', reason: 'payload inválido' };
    const { method, path, body } = item.payload;

    let response: Response;
    try {
      response = await authFetch(
        new Request(`${baseUrl}${path}`, {
          method,
          headers: body === undefined ? {} : { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      );
    } catch {
      return { status: 'retry', error: 'sin conexión' };
    }

    if (response.ok) return { status: 'sent' };
    if (response.status === 401 || response.status === 429 || response.status >= 500) {
      return { status: 'retry', error: `HTTP ${response.status}` };
    }
    return { status: 'discard', reason: `HTTP ${response.status}` };
  };
}
