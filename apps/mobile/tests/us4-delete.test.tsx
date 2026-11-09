import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { createApiClient } from '../src/api/client';
import type { UserDb } from '../src/db/open-user-db';
import { purgeUserData } from '../src/db/purge';
import {
  ACCOUNT_DELETED_NOTICE,
  AuthError,
  createAuthService,
} from '../src/features/auth/auth-service';
import {
  getDbKey,
  getLastUserId,
  getRefreshToken,
  setDbKey,
  setLastUserId,
  setRefreshToken,
} from '../src/session/secure';
import { useSession } from '../src/session/session-store';
import { makeMe } from './support/fixtures';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));

import { api } from '../src/api/instance';
import DeleteAccount from '../src/app/(app)/settings/delete-account';
import { authService } from '../src/features/auth/auth-service';

const BASE = 'http://api.test';
const secureStore = (SecureStore as unknown as { __store: Map<string, string> }).__store;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function signIn(isOnline = true) {
  useSession.setState({
    status: 'signedIn',
    me: makeMe({ onboardingStep: 'done' }),
    accessToken: 'access',
    isOnline,
    notice: null,
  });
}

/** Datos locales de un usuario: clave de la base, refresh token y último usuario. */
async function seedLocalData(userId: string) {
  await setDbKey(userId, 'ab'.repeat(32));
  await setRefreshToken('refresh-1');
  await setLastUserId(userId);
}

beforeEach(() => {
  secureStore.clear();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('4.1 la pantalla de borrar la cuenta', () => {
  it('pide la contraseña y explica que no se puede deshacer', async () => {
    signIn();
    jest.spyOn(authService, 'pendingChanges').mockReturnValue(0);
    await render(<DeleteAccount />);

    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeTruthy();
    expect(screen.getByText(/todos tus datos/i)).toBeTruthy();
    expect(screen.getByLabelText('Contraseña')).toBeTruthy();
    // sin contraseña no se puede confirmar
    expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeDisabled();
    expect(screen.queryByText(/sin sincronizar/i)).toBeNull();
  });

  it('advierte que los cambios pendientes se descartan', async () => {
    signIn();
    jest.spyOn(authService, 'pendingChanges').mockReturnValue(2);
    await render(<DeleteAccount />);
    expect(
      screen.getByText('Tienes 2 cambios sin sincronizar: se descartarán junto con tu cuenta.'),
    ).toBeTruthy();
  });

  it('requiere conexión', async () => {
    signIn(false);
    jest.spyOn(authService, 'pendingChanges').mockReturnValue(0);
    await render(<DeleteAccount />);
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'clave1234');
    expect(screen.getByText(/necesitas internet/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeDisabled();
  });

  it('confirma con la contraseña escrita', async () => {
    signIn();
    jest.spyOn(authService, 'pendingChanges').mockReturnValue(0);
    const remove = jest.spyOn(authService, 'deleteAccount').mockResolvedValueOnce();
    await render(<DeleteAccount />);
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'clave1234');
    await fireEvent.press(screen.getByRole('button', { name: 'Borrar mi cuenta' }));
    expect(remove).toHaveBeenCalledWith('clave1234');
  });

  it('con la contraseña incorrecta lo dice', async () => {
    signIn();
    jest.spyOn(authService, 'pendingChanges').mockReturnValue(0);
    jest
      .spyOn(authService, 'deleteAccount')
      .mockRejectedValueOnce(new AuthError('invalid_credentials', 'x'));
    await render(<DeleteAccount />);
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'mala1234');
    await fireEvent.press(screen.getByRole('button', { name: 'Borrar mi cuenta' }));
    expect(await screen.findByText('La contraseña no es correcta')).toBeTruthy();
  });
});

/** Servicio con red simulada y el borrado local real (SQLite y SecureStore simulados). */
function setup(deleteResponse: () => Response) {
  const calls: { method: string; path: string; authorization: string | null; body: unknown }[] = [];
  const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as Request, init);
    const text = await request.text();
    calls.push({
      method: request.method,
      path: new URL(request.url).pathname,
      authorization: request.headers.get('authorization'),
      body: text ? JSON.parse(text) : null,
    });
    return deleteResponse();
  });
  const service = createAuthService({
    baseUrl: BASE,
    fetchImpl,
    client: createApiClient({
      baseUrl: BASE,
      fetchImpl,
      getAccessToken: () => useSession.getState().accessToken,
      getRefreshToken,
      onTokens: jest.fn(),
      onSessionLost: jest.fn(),
    }).client,
    openDb: jest.fn(async () => ({}) as UserDb),
    closeDb: jest.fn(),
    getOpenDb: () => null,
    syncMe: jest.fn(),
    outboxFor: () => ({ count: () => 0, flush: async () => undefined }),
    deviceName: () => null,
    purgeUserData: (userId) => purgeUserData(userId),
  });
  return { service, calls };
}

describe('4.2 borrar la cuenta en este dispositivo', () => {
  it('envía la contraseña a DELETE /v1/me y luego borra el archivo local, la clave y las credenciales', async () => {
    signIn();
    const userId = useSession.getState().me?.id as string;
    await seedLocalData(userId);
    const { service, calls } = setup(() => new Response(null, { status: 204 }));

    await service.deleteAccount('clave1234');

    expect(calls).toEqual([
      {
        method: 'DELETE',
        path: '/v1/me',
        authorization: 'Bearer access',
        body: { password: 'clave1234' },
      },
    ]);
    expect(SQLite.deleteDatabaseSync).toHaveBeenCalledWith(`saveria-${userId}.db`);
    expect(await getDbKey(userId)).toBeNull();
    expect(await getRefreshToken()).toBeNull();
    expect(await getLastUserId()).toBeNull();
  });

  it('cierra la sesión y avisa que la cuenta fue borrada', async () => {
    signIn();
    const { service } = setup(() => new Response(null, { status: 204 }));
    await service.deleteAccount('clave1234');

    const session = useSession.getState();
    expect(session.status).toBe('signedOut');
    expect(session.me).toBeNull();
    expect(session.notice).toBe(ACCOUNT_DELETED_NOTICE);
  });

  it('con la contraseña incorrecta no borra nada y la sesión sigue', async () => {
    signIn();
    const userId = useSession.getState().me?.id as string;
    await seedLocalData(userId);
    const { service } = setup(() =>
      json(401, { code: 'invalid_credentials', message: 'Credenciales inválidas' }),
    );

    await expect(service.deleteAccount('mala1234')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    expect(SQLite.deleteDatabaseSync).not.toHaveBeenCalled();
    expect(await getDbKey(userId)).not.toBeNull();
    expect(useSession.getState().status).toBe('signedIn');
  });

  it('sin red no borra nada', async () => {
    signIn();
    const userId = useSession.getState().me?.id as string;
    await seedLocalData(userId);
    const { service } = setup(() => {
      throw new TypeError('Network request failed');
    });

    await expect(service.deleteAccount('clave1234')).rejects.toMatchObject({
      code: 'network_error',
    });
    expect(await getDbKey(userId)).not.toBeNull();
    expect(useSession.getState().status).toBe('signedIn');
  });
});

describe('4.2 la cuenta se borró desde otro dispositivo', () => {
  it('al recibir account_deleted se borran el archivo local y la clave, y se cierra la sesión', async () => {
    signIn();
    const userId = useSession.getState().me?.id as string;
    await seedLocalData(userId);
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const { pathname } = new URL((input as Request).url);
      if (pathname === '/v1/auth/refresh') {
        return json(401, { code: 'account_deleted', message: 'La cuenta fue borrada' });
      }
      return json(401, { code: 'unauthorized', message: 'No autorizado' });
    });

    await api.client.GET('/v1/me');

    await waitFor(() => expect(useSession.getState().status).toBe('signedOut'));
    expect(fetchMock).toHaveBeenCalled();
    expect(SQLite.deleteDatabaseSync).toHaveBeenCalledWith(`saveria-${userId}.db`);
    expect(await getDbKey(userId)).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });
});
