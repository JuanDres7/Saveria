import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { createApiClient } from '../src/api/client';
import type { UserDb } from '../src/db/open-user-db';
import { AuthError, createAuthService } from '../src/features/auth/auth-service';
import { type BootstrapDeps, createBootstrap } from '../src/features/auth/bootstrap';
import { mergeMe, readLocalMe } from '../src/features/profile/local-store';
import {
  getDbKey,
  getRefreshToken,
  setDbKey,
  setLastUserId,
  setRefreshToken,
} from '../src/session/secure';
import { type Me, useSession } from '../src/session/session-store';
import { makeMe } from './support/fixtures';
import { MemoryLocalStore } from './support/memory';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));

import { api } from '../src/api/instance';
import ForgotPassword from '../src/app/(auth)/forgot-password';
import { authService } from '../src/features/auth/auth-service';

const BASE = 'http://api.test';
const USER_ID = makeMe().id;
const secureStore = (SecureStore as unknown as { __store: Map<string, string> }).__store;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  secureStore.clear();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  useSession.setState({
    status: 'unknown',
    me: null,
    accessToken: null,
    isOnline: true,
    notice: null,
  });
});

/** Arranque con dependencias simuladas; por defecto hay sesión guardada y datos locales. */
function bootstrapWith(overrides: Partial<BootstrapDeps> = {}) {
  const db = {} as UserDb;
  const deps: BootstrapDeps = {
    getRefreshToken: async () => 'refresh-1',
    getLastUserId: async () => USER_ID,
    openDb: jest.fn(async () => db),
    closeDb: jest.fn(),
    readLocalMe: jest.fn(() => makeMe({ onboardingStep: 'done' })),
    refreshSession: jest.fn(async () => true),
    afterRefresh: jest.fn(async () => undefined),
    ...overrides,
  };
  return { run: createBootstrap(deps), deps, db };
}

describe('5.1 abrir la app con la sesión guardada', () => {
  it('entra directo con los datos locales, sin esperar a la red', async () => {
    // la red nunca responde: aun así la app ya está adentro
    const { run, deps } = bootstrapWith({ refreshSession: () => new Promise(() => undefined) });
    await run();

    const session = useSession.getState();
    expect(session.status).toBe('signedIn');
    expect(session.me?.id).toBe(USER_ID);
    expect(session.accessToken).toBeNull();
    expect(deps.openDb).toHaveBeenCalledWith(USER_ID);
  });

  it('funciona sin conexión: la sesión sigue aunque no se pueda renovar', async () => {
    const { run, deps } = bootstrapWith({ refreshSession: jest.fn(async () => false) });
    await run();
    await waitFor(() => expect(deps.refreshSession).toHaveBeenCalled());

    expect(useSession.getState().status).toBe('signedIn');
    expect(deps.afterRefresh).not.toHaveBeenCalled();
  });

  it('con la sesión renovada trae el estado del servidor y envía lo pendiente', async () => {
    const { run, deps, db } = bootstrapWith();
    await run();
    await waitFor(() => expect(deps.afterRefresh).toHaveBeenCalledWith(db));
  });

  it('sin sesión guardada va a la bienvenida', async () => {
    const { run, deps } = bootstrapWith({ getRefreshToken: async () => null });
    await run();
    expect(useSession.getState().status).toBe('signedOut');
    expect(deps.openDb).not.toHaveBeenCalled();
  });

  it('si la base local no tiene los datos de la cuenta pide entrar, sin borrarla', async () => {
    const { run, deps } = bootstrapWith({ readLocalMe: () => null });
    await run();
    expect(useSession.getState().status).toBe('signedOut');
    expect(deps.closeDb).toHaveBeenCalled();
  });

  it('si la base no se puede abrir pide entrar', async () => {
    const { run } = bootstrapWith({
      openDb: async () => {
        throw new Error('sin SQLCipher');
      },
    });
    await run();
    expect(useSession.getState().status).toBe('signedOut');
  });
});

describe('copia local de la cuenta', () => {
  it('al entrar se guarda y luego se puede armar me sin red', () => {
    const local = new MemoryLocalStore();
    const me: Me = {
      ...makeMe({ onboardingStep: 'done', emailVerified: true }),
      defaultAccount: {
        id: '0199a1b2-0000-7000-8000-00000000a001',
        name: 'Efectivo',
        currency: 'COP',
        initialBalance: '0',
        isDefault: true,
      },
    };
    expect(readLocalMe(local, USER_ID)).toBeNull();

    mergeMe(local, me);
    expect(readLocalMe(local, USER_ID)).toEqual(me);
  });

  it('no arma el me de otro usuario', () => {
    const local = new MemoryLocalStore();
    mergeMe(local, makeMe());
    expect(readLocalMe(local, '0199a1b2-0000-7000-8000-000000000999')).toBeNull();
  });
});

describe('5.2 la sesión venció', () => {
  it('pasa a la bienvenida y conserva la base local con su clave', async () => {
    useSession.setState({ status: 'signedIn', me: makeMe(), accessToken: null, isOnline: true });
    await setRefreshToken('refresh-vencido');
    await setLastUserId(USER_ID);
    await setDbKey(USER_ID, 'ab'.repeat(32));
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json(401, { code: 'unauthorized', message: 'No autorizado' }));

    expect(await api.refreshSession()).toBe(false);

    expect(useSession.getState().status).toBe('signedOut');
    expect(await getRefreshToken()).toBeNull();
    expect(SQLite.deleteDatabaseSync).not.toHaveBeenCalled();
    expect(await getDbKey(USER_ID)).not.toBeNull();
  });

  it('al volver a entrar con el mismo usuario se envían los cambios pendientes', async () => {
    useSession.setState({ status: 'signedOut', me: null, accessToken: null, isOnline: true });
    const fetchImpl = jest.fn(async () =>
      json(200, {
        tokens: { accessToken: 'access-2', accessTokenExpiresAt: 'x', refreshToken: 'refresh-2' },
        me: makeMe({ onboardingStep: 'done' }),
      }),
    );
    const db = {} as UserDb;
    const flush = jest.fn(async () => undefined);
    const openDb = jest.fn(async () => db);
    const service = createAuthService({
      baseUrl: BASE,
      fetchImpl,
      client: createApiClient({
        baseUrl: BASE,
        fetchImpl,
        getAccessToken: () => null,
        getRefreshToken,
        onTokens: jest.fn(),
        onSessionLost: jest.fn(),
      }).client,
      openDb,
      closeDb: jest.fn(),
      getOpenDb: () => null,
      syncMe: (_db, me) => me,
      outboxFor: () => ({ count: () => 1, flush }),
      deviceName: () => null,
      purgeUserData: jest.fn(),
    });

    await service.login({ email: 'ana@mail.com', password: 'clave1234' });

    expect(openDb).toHaveBeenCalledWith(USER_ID);
    expect(flush).toHaveBeenCalled();
    expect(useSession.getState().status).toBe('signedIn');
  });
});

describe('5.3 olvidé mi contraseña', () => {
  it('muestra el mensaje neutral del servidor', async () => {
    const forgot = jest
      .spyOn(authService, 'forgotPassword')
      .mockResolvedValueOnce('Si el correo está registrado, te llegará un enlace');
    await render(<ForgotPassword />);
    await fireEvent.changeText(screen.getByLabelText('Correo'), '  Ana@Mail.com ');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(forgot).toHaveBeenCalledWith('ana@mail.com');
    expect(
      await screen.findByText('Si el correo está registrado, te llegará un enlace'),
    ).toBeTruthy();
  });

  it('valida el correo antes de enviarlo', async () => {
    const forgot = jest.spyOn(authService, 'forgotPassword');
    await render(<ForgotPassword />);
    await fireEvent.changeText(screen.getByLabelText('Correo'), 'no-es-correo');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(forgot).not.toHaveBeenCalled();
  });

  it('requiere conexión', async () => {
    useSession.setState({ isOnline: false });
    await render(<ForgotPassword />);
    expect(screen.getByText(/necesitas internet/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeDisabled();
  });

  it('sin red avisa que se necesita internet', async () => {
    jest
      .spyOn(authService, 'forgotPassword')
      .mockRejectedValueOnce(new AuthError('network_error', 'Necesitas internet para continuar'));
    await render(<ForgotPassword />);
    await fireEvent.changeText(screen.getByLabelText('Correo'), 'ana@mail.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByText('Necesitas internet para continuar')).toBeTruthy();
  });

  it('el servicio envía el correo a POST /v1/auth/password/forgot y devuelve el mensaje', async () => {
    const calls: { path: string; body: unknown }[] = [];
    const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input as Request, init);
      calls.push({ path: new URL(request.url).pathname, body: JSON.parse(await request.text()) });
      return json(202, { message: 'neutral' });
    });
    const service = createAuthService({
      baseUrl: BASE,
      fetchImpl,
      client: createApiClient({
        baseUrl: BASE,
        fetchImpl,
        getAccessToken: () => null,
        getRefreshToken,
        onTokens: jest.fn(),
        onSessionLost: jest.fn(),
      }).client,
      openDb: jest.fn(),
      closeDb: jest.fn(),
      getOpenDb: () => null,
      syncMe: (_db, me) => me,
      outboxFor: () => ({ count: () => 0, flush: async () => undefined }),
      deviceName: () => null,
      purgeUserData: jest.fn(),
    });

    expect(await service.forgotPassword('ana@mail.com')).toBe('neutral');
    expect(calls).toEqual([{ path: '/v1/auth/password/forgot', body: { email: 'ana@mail.com' } }]);
  });
});
