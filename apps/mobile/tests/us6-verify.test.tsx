import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createApiClient } from '../src/api/client';
import type { UserDb } from '../src/db/open-user-db';
import { AuthError } from '../src/features/auth/auth-service';
import { createVerificationService } from '../src/features/verification/verification-service';
import { watchOutbox } from '../src/outbox/user-outbox';
import { routeGroupFor } from '../src/session/guards';
import { type Me, useSession } from '../src/session/session-store';
import { makeMe } from './support/fixtures';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));

import VerifyEmailGate from '../src/app/(app)/verify-email-gate';
import { VerifyBanner } from '../src/features/verification/VerifyBanner';
import { verificationService } from '../src/features/verification/verification-service';

const BASE = 'http://api.test';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function signIn(me: Me, isOnline = true) {
  useSession.setState({ status: 'signedIn', me, accessToken: 'access', isOnline, notice: null });
}

const group = () => {
  const { status, me, isOnline } = useSession.getState();
  return routeGroupFor({ status, me, isOnline });
};

/** Servicio con red simulada: `GET /v1/me` responde con `serverMe`. */
function setup(serverMe: () => Me) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as Request, init);
    const { pathname } = new URL(request.url);
    const text = await request.text();
    calls.push({ method: request.method, path: pathname, body: text ? JSON.parse(text) : null });
    if (pathname === '/v1/me') return json(200, serverMe());
    if (pathname === '/v1/auth/email/verification') return json(202, { message: 'enviado' });
    if (pathname === '/v1/auth/email') {
      const { email } = JSON.parse(text) as { email: string };
      return json(202, { ...serverMe(), email });
    }
    return json(404, { code: 'not_found', message: 'x' });
  });
  const syncMe = jest.fn((_db: UserDb, me: Me) => me);
  const service = createVerificationService({
    client: createApiClient({
      baseUrl: BASE,
      fetchImpl,
      getAccessToken: () => useSession.getState().accessToken,
      getRefreshToken: async () => null,
      onTokens: jest.fn(),
      onSessionLost: jest.fn(),
    }).client,
    getOpenDb: () => ({ userId: makeMe().id, db: {} as UserDb }),
    syncMe,
  });
  return { service, calls, syncMe };
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('6.4 / 6.5 el bloqueo de los 7 días', () => {
  it('con conexión y verificationRequired el usuario va al bloqueo', () => {
    signIn(makeMe({ verificationRequired: true }));
    expect(group()).toBe('verify-gate');
  });

  it('6.5 sin conexión la app funciona normal aunque haya pasado el plazo', () => {
    signIn(makeMe({ verificationRequired: true }), false);
    expect(group()).toBe('app');
  });

  it('6.5 al volver la conexión se consulta al servidor y el bloqueo aparece si lo confirma', async () => {
    signIn(makeMe({ verificationRequired: false }), false);
    const { service, calls, syncMe } = setup(() => makeMe({ verificationRequired: true }));
    const stop = service.watchOnReconnect();

    await act(async () => {
      useSession.getState().setOnline(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    stop();

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /v1/me']);
    expect(syncMe).toHaveBeenCalled();
    expect(group()).toBe('verify-gate');
  });

  it('al volver la app a primer plano se consulta al servidor (correo confirmado en el navegador)', async () => {
    signIn(makeMe());
    const { service, calls } = setup(() => makeMe({ emailVerified: true }));
    let onChange: ((state: string) => void) | undefined;
    const remove = jest.fn();
    const stop = service.watchOnReconnect({
      addEventListener: ((_event: string, handler: (state: string) => void) => {
        onChange = handler;
        return { remove };
      }) as never,
    });

    await act(async () => {
      onChange?.('background');
      onChange?.('active');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    stop();

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /v1/me']);
    expect(useSession.getState().me?.emailVerified).toBe(true);
    expect(remove).toHaveBeenCalled();
  });

  it('FR-032 con el bloqueo visible, los cambios pendientes se siguen enviando al volver la red', async () => {
    signIn(makeMe({ verificationRequired: true }), false);
    const flush = jest.fn(async () => ({ sent: 1, discarded: 0, remaining: 0, stoppedBy: null }));
    const stop = watchOutbox(() => ({ flush }));

    useSession.getState().setOnline(true);
    stop();

    expect(group()).toBe('verify-gate');
    expect(flush).toHaveBeenCalledTimes(1);
  });
});

describe('la pantalla de bloqueo', () => {
  it('explica que los datos se conservan y muestra el correo', async () => {
    signIn(makeMe({ verificationRequired: true }));
    await render(<VerifyEmailGate />);
    expect(screen.getByText(/ana@mail\.com sigue sin confirmar/)).toBeTruthy();
    expect(screen.getByText(/Tus datos están a salvo/)).toBeTruthy();
  });

  it('"ya confirmé" quita el bloqueo cuando el servidor lo ve verificado', async () => {
    signIn(makeMe({ verificationRequired: true }));
    const { service } = setup(() => makeMe({ emailVerified: true }));
    jest.spyOn(verificationService, 'refresh').mockImplementation(service.refresh);

    await render(<VerifyEmailGate />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ya confirmé mi correo' }));

    expect(useSession.getState().me?.emailVerified).toBe(true);
    expect(group()).toBe('app');
  });

  it('"ya confirmé" sin verificar todavía lo dice y el bloqueo sigue', async () => {
    signIn(makeMe({ verificationRequired: true }));
    jest
      .spyOn(verificationService, 'refresh')
      .mockResolvedValueOnce(makeMe({ verificationRequired: true }));
    await render(<VerifyEmailGate />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ya confirmé mi correo' }));
    expect(await screen.findByText(/Todavía no vemos tu correo confirmado/)).toBeTruthy();
    expect(group()).toBe('verify-gate');
  });

  it('reenviar muestra el mensaje neutral del servidor', async () => {
    signIn(makeMe({ verificationRequired: true }));
    jest.spyOn(verificationService, 'resend').mockResolvedValueOnce('Te enviamos un enlace nuevo');
    await render(<VerifyEmailGate />);
    await fireEvent.press(screen.getByRole('button', { name: 'Reenviar correo' }));
    expect(await screen.findByText('Te enviamos un enlace nuevo')).toBeTruthy();
  });

  it('corregir el correo valida el formato antes de enviarlo', async () => {
    signIn(makeMe({ verificationRequired: true }));
    const change = jest.spyOn(verificationService, 'changeEmail');
    await render(<VerifyEmailGate />);
    await fireEvent.changeText(screen.getByLabelText('Correo correcto'), 'no-es-correo');
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar correo' }));
    expect(change).not.toHaveBeenCalled();
  });

  it('corregir el correo envía el nuevo y lo confirma', async () => {
    signIn(makeMe({ verificationRequired: true }));
    const { service, calls } = setup(() => makeMe({ verificationRequired: true }));
    jest.spyOn(verificationService, 'changeEmail').mockImplementation(service.changeEmail);
    await render(<VerifyEmailGate />);
    await fireEvent.changeText(screen.getByLabelText('Correo correcto'), ' Ana@Correo.com ');
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar correo' }));

    expect(await screen.findByText('Listo. Te enviamos un enlace a ana@correo.com.')).toBeTruthy();
    expect(calls).toEqual([
      { method: 'PUT', path: '/v1/auth/email', body: { email: 'ana@correo.com' } },
    ]);
    expect(useSession.getState().me?.email).toBe('ana@correo.com');
  });

  it('un correo que no se puede usar muestra un mensaje genérico', async () => {
    signIn(makeMe({ verificationRequired: true }));
    jest
      .spyOn(verificationService, 'changeEmail')
      .mockRejectedValueOnce(new AuthError('email_unavailable', 'x'));
    await render(<VerifyEmailGate />);
    await fireEvent.changeText(screen.getByLabelText('Correo correcto'), 'otra@mail.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar correo' }));
    expect(await screen.findByText('No pudimos usar ese correo. Prueba con otro.')).toBeTruthy();
  });
});

describe('el recordatorio en la pantalla principal', () => {
  it('6.1 sin verificar muestra el recordatorio con el plazo', async () => {
    signIn(makeMe());
    await render(<VerifyBanner />);
    expect(screen.getByText('Confirma tu correo')).toBeTruthy();
    expect(screen.getByText(/Te enviamos un enlace a ana@mail\.com/)).toBeTruthy();
    expect(screen.getByText(/29 de octubre/)).toBeTruthy();
  });

  it('6.2 con el correo verificado no se muestra', async () => {
    signIn(makeMe({ emailVerified: true }));
    await render(<VerifyBanner />);
    expect(screen.queryByText('Confirma tu correo')).toBeNull();
  });

  it('6.3 permite reenviar el correo', async () => {
    signIn(makeMe());
    const resend = jest.spyOn(verificationService, 'resend').mockResolvedValueOnce('enviado');
    await render(<VerifyBanner />);
    await fireEvent.press(screen.getByRole('button', { name: 'Reenviar correo' }));
    expect(resend).toHaveBeenCalled();
    expect(await screen.findByText('enviado')).toBeTruthy();
  });

  it('sin conexión no ofrece reenviar ni corregir', async () => {
    signIn(makeMe(), false);
    await render(<VerifyBanner />);
    expect(screen.queryByRole('button', { name: 'Reenviar correo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Corregir mi correo' })).toBeNull();
  });

  it('FR-034 antes de los 7 días también se puede corregir el correo', async () => {
    signIn(makeMe());
    await render(<VerifyBanner />);
    expect(screen.queryByLabelText('Correo correcto')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Corregir mi correo' }));
    expect(screen.getByLabelText('Correo correcto')).toBeTruthy();
  });

  it('al corregirlo, el recordatorio muestra el correo nuevo', async () => {
    signIn(makeMe());
    const { service, calls } = setup(() => makeMe());
    jest.spyOn(verificationService, 'changeEmail').mockImplementation(service.changeEmail);
    await render(<VerifyBanner />);
    await fireEvent.press(screen.getByRole('button', { name: 'Corregir mi correo' }));
    await fireEvent.changeText(screen.getByLabelText('Correo correcto'), 'ana@correo.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar correo' }));

    expect(
      await screen.findByText(/Te enviamos un enlace a ana@correo\.com\. Tienes/),
    ).toBeTruthy();
    expect(calls).toEqual([
      { method: 'PUT', path: '/v1/auth/email', body: { email: 'ana@correo.com' } },
    ]);
  });
});
