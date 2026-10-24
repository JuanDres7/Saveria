import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { createApiClient } from '../src/api/client';
import type { UserDb } from '../src/db/open-user-db';
import { AuthError, createAuthService } from '../src/features/auth/auth-service';
import {
  getPendingRevocation,
  getRefreshToken,
  setDbKey,
  setPendingRevocation,
} from '../src/session/secure';
import { type Me, useSession } from '../src/session/session-store';
import { makeMe } from './support/fixtures';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    Link: ({ children }: { children: unknown }) =>
      React.createElement(React.Fragment, null, children),
    router: { push: jest.fn(), back: jest.fn() },
  };
});

import Login from '../src/app/(auth)/login';
import Register from '../src/app/(auth)/register';
import Welcome from '../src/app/(auth)/welcome';
import { authService } from '../src/features/auth/auth-service';

const BASE = 'http://api.test';
const USER_ID = '0199a1b2-0000-7000-8000-000000000001';

const secureStore = (SecureStore as unknown as { __store: Map<string, string> }).__store;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const authResponse = () => ({
  tokens: { accessToken: 'access-1', accessTokenExpiresAt: 'x', refreshToken: 'refresh-1' },
  me: makeMe({ onboardingStep: 'ai_name' }),
});

/** Servicio de autenticación con red y base local simuladas. */
function setup(options: { pendingChanges?: number; logoutFails?: boolean } = {}) {
  const calls: { path: string; authorization: string | null; body: unknown }[] = [];
  const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as Request, init);
    const { pathname } = new URL(request.url);
    const text = await request.text();
    calls.push({
      path: pathname,
      authorization: request.headers.get('authorization'),
      body: text ? JSON.parse(text) : null,
    });
    if (pathname === '/v1/auth/logout') {
      if (options.logoutFails) throw new TypeError('Network request failed');
      return new Response(null, { status: 204 });
    }
    if (pathname === '/v1/auth/login' || pathname === '/v1/auth/register') {
      return json(pathname.endsWith('register') ? 201 : 200, authResponse());
    }
    return json(404, { code: 'not_found', message: 'x' });
  });

  const db = {} as UserDb;
  let openDb: { userId: string; db: UserDb } | null = null;
  const flush = jest.fn(async () => undefined);
  const deps = {
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
    openDb: jest.fn(async (userId: string) => {
      openDb = { userId, db };
      return db;
    }),
    closeDb: jest.fn(() => {
      openDb = null;
    }),
    getOpenDb: () => openDb,
    syncMe: jest.fn((_db: UserDb, me: Me) => me),
    outboxFor: () => ({ count: () => options.pendingChanges ?? 0, flush }),
    deviceName: () => 'Pixel de prueba',
    purgeUserData: jest.fn(async () => undefined),
  };
  const service = createAuthService(deps);
  return { service, deps, calls, flush };
}

beforeEach(() => {
  secureStore.clear();
  jest.clearAllMocks();
  useSession.setState({
    status: 'signedOut',
    me: null,
    accessToken: null,
    isOnline: true,
    notice: null,
  });
});

describe('auth-service: entrar', () => {
  it('login guarda el refresh token, abre la base del usuario, guarda me y vacía el outbox', async () => {
    const { service, deps, calls, flush } = setup();
    await service.login({ email: 'ana@mail.com', password: 'clave1234' });

    expect(await getRefreshToken()).toBe('refresh-1');
    expect(deps.openDb).toHaveBeenCalledWith(USER_ID);
    expect(deps.syncMe).toHaveBeenCalled();
    expect(flush).toHaveBeenCalled();
    expect(useSession.getState()).toMatchObject({ status: 'signedIn', accessToken: 'access-1' });

    const login = calls.find((c) => c.path === '/v1/auth/login');
    expect(login?.body).toMatchObject({
      email: 'ana@mail.com',
      device: { id: expect.any(String), name: 'Pixel de prueba' },
    });
  });

  it('register envía la versión vigente de la política', async () => {
    const { service, calls } = setup();
    await service.register({ email: 'ana@mail.com', password: 'clave1234', policyAccepted: true });
    const register = calls.find((c) => c.path === '/v1/auth/register');
    expect(register?.body).toMatchObject({ policyAccepted: true, policyVersion: '2026-10-v1' });
    expect(useSession.getState().status).toBe('signedIn');
  });
});

describe('auth-service: cerrar sesión', () => {
  async function signIn(service: ReturnType<typeof setup>['service']) {
    await service.login({ email: 'ana@mail.com', password: 'clave1234' });
    await setDbKey(USER_ID, 'a'.repeat(64));
  }

  it('1.6 con conexión: limpia el estado visible y revoca la sesión en el servidor', async () => {
    const { service, deps, calls } = setup();
    await signIn(service);

    const result = await service.logout();

    expect(result.pendingChanges).toBe(0);
    expect(useSession.getState()).toMatchObject({
      status: 'signedOut',
      me: null,
      accessToken: null,
    });
    expect(await getRefreshToken()).toBeNull();
    expect(deps.closeDb).toHaveBeenCalled();
    const logout = calls.find((c) => c.path === '/v1/auth/logout');
    expect(logout?.body).toEqual({ refreshToken: 'refresh-1' });
    // sin Authorization: así el servidor revoca exactamente la sesión de ese refresh token
    expect(logout?.authorization).toBeNull();
    expect(await getPendingRevocation()).toBeNull();
    expect(useSession.getState().notice).toBeNull();
  });

  it('1.7 sin conexión y con 1 cambio pendiente: avisa, cierra la sesión y conserva la base', async () => {
    const { service, deps, calls } = setup({ pendingChanges: 1 });
    await signIn(service);
    useSession.setState({ isOnline: false });

    const result = await service.logout();

    expect(result.pendingChanges).toBe(1);
    expect(useSession.getState().status).toBe('signedOut');
    expect(useSession.getState().notice).toBe(
      'Tienes 1 cambio sin sincronizar; se enviará cuando vuelvas a entrar',
    );
    expect(await getRefreshToken()).toBeNull();
    // la base se cierra pero NO se borra: ni el archivo ni su clave
    expect(deps.closeDb).toHaveBeenCalled();
    expect(SQLite.deleteDatabaseSync).not.toHaveBeenCalled();
    expect(secureStore.get(`saveria.dbkey.${USER_ID}`)).toBe('a'.repeat(64));
    // el refresh token queda guardado para revocarlo cuando vuelva la red
    expect(await getPendingRevocation()).toBe('refresh-1');
    expect(calls.some((c) => c.path === '/v1/auth/logout')).toBe(false);

    await render(<Welcome />);
    expect(screen.getByText(/Tienes 1 cambio sin sincronizar/)).toBeTruthy();
  });

  it('el aviso usa plural con varios cambios', async () => {
    const { service } = setup({ pendingChanges: 3 });
    await signIn(service);
    await service.logout();
    expect(useSession.getState().notice).toBe(
      'Tienes 3 cambios sin sincronizar; se enviarán cuando vuelvas a entrar',
    );
  });

  it('si la red falla al cerrar sesión, guarda el token para revocarlo después', async () => {
    const { service } = setup({ logoutFails: true });
    await signIn(service);
    await service.logout();
    expect(useSession.getState().status).toBe('signedOut');
    expect(await getPendingRevocation()).toBe('refresh-1');
  });
});

describe('auth-service: revocación pendiente', () => {
  it('al volver la red envía pendingRevocation sin Authorization y lo borra', async () => {
    const { service, calls } = setup();
    useSession.setState({ isOnline: false, accessToken: 'token-de-otro-usuario' });
    await setPendingRevocation('refresh-viejo');
    const stop = service.watchPendingRevocation();

    await act(async () => useSession.getState().setOnline(true));

    await waitFor(async () => expect(await getPendingRevocation()).toBeNull());
    const logout = calls.find((c) => c.path === '/v1/auth/logout');
    expect(logout?.body).toEqual({ refreshToken: 'refresh-viejo' });
    expect(logout?.authorization).toBeNull();
    stop();
  });

  it('si el envío falla, conserva pendingRevocation para el siguiente intento', async () => {
    const { service } = setup({ logoutFails: true });
    await setPendingRevocation('refresh-viejo');
    await service.sendPendingRevocation();
    expect(await getPendingRevocation()).toBe('refresh-viejo');
  });

  it('después de entrar también intenta enviar la revocación pendiente', async () => {
    const { service, calls } = setup();
    await setPendingRevocation('refresh-viejo');
    await service.login({ email: 'ana@mail.com', password: 'clave1234' });
    await waitFor(async () => expect(await getPendingRevocation()).toBeNull());
    expect(calls.filter((c) => c.path === '/v1/auth/logout')).toHaveLength(1);
  });
});

describe('pantalla de registro', () => {
  async function fill() {
    await render(<Register />);
    await fireEvent.changeText(screen.getByLabelText('Correo'), 'ana@mail.com');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'clave1234');
  }

  const submit = () => screen.getByRole('button', { name: 'Crear cuenta' });

  it('1.2 sin aceptar la política el botón está deshabilitado', async () => {
    await fill();
    expect(submit()).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(submit()).toBeEnabled();
  });

  it('enlaza la política de datos', async () => {
    await fill();
    expect(screen.getByText('política de tratamiento de datos')).toBeTruthy();
  });

  it('sin conexión avisa que necesita internet y no deja enviar', async () => {
    useSession.setState({ isOnline: false });
    await fill();
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(screen.getByText(/necesitas internet/i)).toBeTruthy();
    expect(submit()).toBeDisabled();
  });

  it('muestra el error genérico si el correo no se puede usar', async () => {
    jest
      .spyOn(authService, 'register')
      .mockRejectedValueOnce(
        new AuthError('email_unavailable', 'No se pudo crear la cuenta con ese correo'),
      );
    await fill();
    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(submit());
    expect(await screen.findByText('No se pudo crear la cuenta con ese correo')).toBeTruthy();
  });
});

describe('pantalla de login', () => {
  async function submitWith(error: AuthError) {
    jest.spyOn(authService, 'login').mockRejectedValueOnce(error);
    await render(<Login />);
    await fireEvent.changeText(screen.getByLabelText('Correo'), 'ana@mail.com');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'mala1234');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
  }

  it.each([
    ['401', new AuthError('invalid_credentials', 'Correo o contraseña incorrectos')],
    ['429', new AuthError('too_many_attempts', 'Demasiados intentos')],
  ])('1.5 ante un %s muestra el mismo mensaje genérico', async (_n, error) => {
    await submitWith(error);
    expect(
      await screen.findByText('No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo.'),
    ).toBeTruthy();
  });
});
