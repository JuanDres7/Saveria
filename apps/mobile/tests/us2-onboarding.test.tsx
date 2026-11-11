import { fireEvent, render, screen } from '@testing-library/react-native';
import { createOnboardingCompleter } from '../src/features/onboarding/complete';
import { mergeMe, type ProfileFields } from '../src/features/profile/local-store';
import { createProfileService } from '../src/features/profile/profile-service';
import { createOutbox } from '../src/outbox/outbox';
import { entryRouteFor, ONBOARDING_ROUTE } from '../src/session/guards';
import { type Me, useSession } from '../src/session/session-store';
import { makeMe } from './support/fixtures';
import { MemoryLocalStore, MemoryOutboxStore } from './support/memory';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

import { router } from 'expo-router';
import Home from '../src/app/(app)/home';
import AiMode from '../src/app/(onboarding)/ai-mode';
import AiName from '../src/app/(onboarding)/ai-name';
import City from '../src/app/(onboarding)/city';
import Currency from '../src/app/(onboarding)/currency';
import { completeOnboarding } from '../src/features/onboarding/complete';
import { profileService } from '../src/features/profile/profile-service';

const USER_ID = '0199a1b2-0000-7000-8000-000000000001';
const SERVER_TIME = '2026-10-22T12:00:00.000Z';

function meWith(profile: Partial<ProfileFields> = {}, overrides: Partial<Me> = {}): Me {
  const me = makeMe({ onboardingStep: 'ai_name' });
  return { ...me, ...overrides, profile: { ...me.profile, updatedAt: SERVER_TIME, ...profile } };
}

/** Servicios de perfil y onboarding con base local, outbox y reloj en memoria. */
function setup(options: { online?: boolean; now?: number; me?: Me } = {}) {
  const me = options.me ?? meWith();
  const local = new MemoryLocalStore();
  local.writeProfile(USER_ID, me.profile);
  const queue = new MemoryOutboxStore();
  const send = jest.fn(async () => ({ status: 'sent' as const }));
  let ids = 0;
  const outbox = createOutbox(queue, send, { newId: () => `item-${++ids}` });
  const flush = jest.spyOn(outbox, 'flush');
  const now = options.now ?? Date.parse('2026-10-22T13:00:00.000Z');

  useSession.setState({
    status: 'signedIn',
    me,
    accessToken: 'access',
    isOnline: options.online ?? true,
    notice: null,
  });
  const context = () => ({ userId: USER_ID, local, outbox });
  const profile = createProfileService({ context, now: () => now });
  const completer = createOnboardingCompleter({
    context,
    now: () => now,
    newId: () => '0199a1b2-0000-7000-8000-00000000a001',
  });
  return { local, queue, flush, profile, completer };
}

const payloads = (queue: MemoryOutboxStore) =>
  queue.items.map(
    (i) => i.payload as { method: string; path: string; body: Record<string, unknown> },
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('2.1 orden de los pasos', () => {
  it('nombre para la IA → país → ciudad → moneda → modo de IA', () => {
    expect(ONBOARDING_ROUTE).toEqual({
      ai_name: '/ai-name',
      country: '/country',
      city: '/city',
      currency: '/currency',
      ai_mode: '/ai-mode',
    });
  });

  it('el nombre para la IA guarda el valor, avanza a país y lleva a /country', async () => {
    setup();
    const save = jest.spyOn(profileService, 'save').mockResolvedValue(meWith().profile);
    await render(<AiName />);
    await fireEvent.changeText(screen.getByLabelText('Nombre para la IA'), 'Ana');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(save).toHaveBeenCalledWith({ aiName: 'Ana', onboardingStep: 'country' });
    expect(router.replace).toHaveBeenCalledWith('/country');
  });

  it('el nombre para la IA se puede saltar', async () => {
    setup();
    const save = jest.spyOn(profileService, 'save').mockResolvedValue(meWith().profile);
    await render(<AiName />);
    await fireEvent.press(screen.getByRole('button', { name: 'Saltar' }));
    expect(save).toHaveBeenCalledWith({ aiName: null, onboardingStep: 'country' });
  });

  it('la ciudad avanza a moneda', async () => {
    setup({ me: meWith({ onboardingStep: 'city', countryCode: 'CO' }) });
    const save = jest.spyOn(profileService, 'save').mockResolvedValue(meWith().profile);
    await render(<City />);
    await fireEvent.changeText(screen.getByLabelText('Ciudad'), 'Medellín');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(save).toHaveBeenCalledWith({ city: 'Medellín', onboardingStep: 'currency' });
    expect(router.replace).toHaveBeenCalledWith('/currency');
  });
});

describe('2.2 moneda sugerida', () => {
  it('con Colombia, COP aparece preseleccionada y se puede cambiar', async () => {
    setup({ me: meWith({ onboardingStep: 'currency', countryCode: 'CO' }) });
    const save = jest.spyOn(profileService, 'save').mockResolvedValue(meWith().profile);
    await render(<Currency />);
    expect(screen.getByRole('radio', { name: /COP/ })).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: /USD/ }));
    expect(screen.getByRole('radio', { name: /USD/ })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(save).toHaveBeenCalledWith({ primaryCurrency: 'USD', onboardingStep: 'ai_mode' });
  });

  it('con "Otro" no preselecciona nada y no deja continuar sin elegir', async () => {
    setup({ me: meWith({ onboardingStep: 'currency', countryCode: 'ZZ' }) });
    await render(<Currency />);
    expect(screen.getAllByRole('radio').filter((r) => r.props['aria-checked'])).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });
});

describe('2.3 modo de IA', () => {
  it('manual viene seleccionado, con la explicación de ambos modos', async () => {
    setup({ me: meWith({ onboardingStep: 'ai_mode', primaryCurrency: 'COP' }) });
    await render(<AiMode />);
    expect(screen.getByRole('radio', { name: /Manual/ })).toBeChecked();
    expect(screen.getByText(/te pregunta antes de guardar/i)).toBeTruthy();
    expect(screen.getByText(/guarda sin preguntar/i)).toBeTruthy();
  });

  it('continuar en manual guarda el modo y termina el onboarding', async () => {
    setup({ me: meWith({ onboardingStep: 'ai_mode', primaryCurrency: 'COP' }) });
    const save = jest.spyOn(profileService, 'save').mockResolvedValue(meWith().profile);
    const complete = jest.spyOn(completeOnboarding, 'run').mockReturnValue(undefined);
    await render(<AiMode />);
    await fireEvent.press(screen.getByRole('button', { name: 'Terminar' }));
    expect(save).toHaveBeenCalledWith({ aiMode: 'manual' }, { autoModeConfirmed: false });
    expect(complete).toHaveBeenCalled();
  });

  it('elegir automático pide confirmarlo y la confirmación viaja al servidor', async () => {
    setup({ me: meWith({ onboardingStep: 'ai_mode', primaryCurrency: 'COP' }) });
    const save = jest.spyOn(profileService, 'save').mockResolvedValue(meWith().profile);
    jest.spyOn(completeOnboarding, 'run').mockReturnValue(undefined);
    await render(<AiMode />);
    await fireEvent.press(screen.getByRole('radio', { name: /Automático/ }));
    expect(screen.getByText(/se pueden deshacer desde el historial/i)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Activar el modo automático y terminar' }),
    );
    expect(save).toHaveBeenCalledWith({ aiMode: 'auto' }, { autoModeConfirmed: true });
  });
});

describe('2.4 "Efectivo" sin conexión (SC-004)', () => {
  it('crea la cuenta en la base local, termina el onboarding y encola la llamada al servidor', () => {
    const { local, queue, flush, completer } = setup({
      online: false,
      me: meWith({ onboardingStep: 'ai_mode', primaryCurrency: 'COP' }),
    });

    completer.run();

    expect(local.readDefaultAccount()).toEqual({
      id: '0199a1b2-0000-7000-8000-00000000a001',
      name: 'Efectivo',
      currency: 'COP',
      initialBalance: '0',
      isDefault: true,
    });
    expect(local.readProfile(USER_ID)?.onboardingStep).toBe('done');
    expect(payloads(queue)).toEqual([
      {
        method: 'POST',
        path: '/v1/me/onboarding/complete',
        body: { defaultAccountId: '0199a1b2-0000-7000-8000-00000000a001' },
      },
    ]);
    const me = useSession.getState().me;
    expect(me?.profile.onboardingStep).toBe('done');
    expect(me?.defaultAccount?.name).toBe('Efectivo');
    expect(flush).not.toHaveBeenCalled();
  });

  it('con conexión envía de inmediato', () => {
    const { flush, completer } = setup({
      me: meWith({ onboardingStep: 'ai_mode', primaryCurrency: 'COP' }),
    });
    completer.run();
    expect(flush).toHaveBeenCalled();
  });

  it('sin moneda principal no termina', () => {
    const { local, completer } = setup({ me: meWith({ onboardingStep: 'ai_mode' }) });
    expect(() => completer.run()).toThrow();
    expect(local.readDefaultAccount()).toBeNull();
  });

  it('repetirlo no crea otra cuenta', () => {
    const { local, completer } = setup({
      me: meWith({ onboardingStep: 'ai_mode', primaryCurrency: 'COP' }),
    });
    completer.run();
    completer.run();
    expect(local.accounts).toHaveLength(1);
  });
});

describe('2.5 retomar el onboarding', () => {
  it.each([
    ['ai_name', '/ai-name'],
    ['city', '/city'],
    ['ai_mode', '/ai-mode'],
  ] as const)('con el paso %s la ruta de entrada es %s', (step, route) => {
    expect(entryRouteFor('onboarding', meWith({ onboardingStep: step }))).toBe(route);
  });

  it('al volver a entrar se conserva el progreso local más nuevo que el del servidor', () => {
    const local = new MemoryLocalStore();
    local.writeProfile(USER_ID, {
      ...meWith().profile,
      countryCode: 'CO',
      onboardingStep: 'city',
      updatedAt: '2026-10-22T13:00:00.000Z',
    });
    const merged = mergeMe(local, meWith({ onboardingStep: 'country' }));
    expect(merged.profile.onboardingStep).toBe('city');
    expect(merged.profile.countryCode).toBe('CO');
  });

  it('si el servidor es más nuevo, gana el servidor y se guarda en la base local', () => {
    const local = new MemoryLocalStore();
    local.writeProfile(USER_ID, { ...meWith().profile, updatedAt: '2026-10-22T11:00:00.000Z' });
    const merged = mergeMe(local, meWith({ onboardingStep: 'currency', countryCode: 'CO' }));
    expect(merged.profile.onboardingStep).toBe('currency');
    expect(local.readProfile(USER_ID)?.onboardingStep).toBe('currency');
  });

  it('si el servidor aún no tiene "Efectivo", se usa la cuenta creada sin conexión', () => {
    const local = new MemoryLocalStore();
    const account = {
      id: 'a1',
      name: 'Efectivo',
      currency: 'COP',
      initialBalance: '0',
      isDefault: true,
    };
    local.writeAccount(account);
    expect(mergeMe(local, meWith()).defaultAccount).toEqual(account);
  });
});

describe('profile-service', () => {
  it('guarda primero en la base local, actualiza la sesión y encola el registro completo', async () => {
    const { local, queue, flush, profile } = setup({ online: false });
    await profile.save({ aiName: 'Ana', onboardingStep: 'country' });

    expect(local.readProfile(USER_ID)?.aiName).toBe('Ana');
    expect(useSession.getState().me?.profile.onboardingStep).toBe('country');
    const [put] = payloads(queue);
    expect(put).toMatchObject({ method: 'PUT', path: '/v1/me/profile' });
    expect(put?.body).toMatchObject({
      aiName: 'Ana',
      countryCode: null,
      referenceCurrencies: [],
      aiMode: 'manual',
      onboardingStep: 'country',
    });
    expect(flush).not.toHaveBeenCalled();
  });

  it('con conexión lo envía de inmediato', async () => {
    const { queue, flush, profile } = setup();
    await profile.save({ aiName: 'Ana' });
    expect(flush).toHaveBeenCalled();
    await flush.mock.results[0]?.value;
    expect(queue.items).toHaveLength(0);
  });

  it('con el reloj del teléfono atrasado, el cambio igual queda más nuevo que el del servidor', async () => {
    // el teléfono va 1 h detrás del servidor
    const { profile } = setup({ now: Date.parse(SERVER_TIME) - 60 * 60 * 1000 });
    const saved = await profile.save({ aiName: 'Ana' });
    expect(Date.parse(saved.updatedAt)).toBeGreaterThan(Date.parse(SERVER_TIME));
  });

  it('el paso solo avanza', async () => {
    const { profile } = setup({ me: meWith({ onboardingStep: 'currency' }) });
    const saved = await profile.save({ onboardingStep: 'country' });
    expect(saved.onboardingStep).toBe('currency');
  });

  it('la moneda principal sale de las de referencia', async () => {
    const { profile } = setup({ me: meWith({ referenceCurrencies: ['USD', 'EUR'] }) });
    const saved = await profile.save({ primaryCurrency: 'USD' });
    expect(saved.referenceCurrencies).toEqual(['EUR']);
  });

  it('la confirmación del modo automático viaja en el cambio encolado', async () => {
    const { queue, profile } = setup({ online: false });
    await profile.save({ aiMode: 'auto' }, { autoModeConfirmed: true });
    expect(payloads(queue)[0]?.body.autoModeConfirmed).toBe(true);
  });

  it('ante un 409 adopta la versión del servidor si es más nueva', () => {
    const { local, profile } = setup();
    const server = {
      ...meWith().profile,
      aiName: 'Servidor',
      updatedAt: '2026-10-22T14:00:00.000Z',
    };
    profile.adoptServerProfile(server);
    expect(local.readProfile(USER_ID)?.aiName).toBe('Servidor');
    expect(useSession.getState().me?.profile.aiName).toBe('Servidor');
  });

  it('ante un 409 NO adopta una versión más vieja que la local (hay un cambio más nuevo en cola)', async () => {
    const { local, profile } = setup();
    await profile.save({ aiName: 'Local' });
    profile.adoptServerProfile({ ...meWith().profile, aiName: 'Viejo', updatedAt: SERVER_TIME });
    expect(local.readProfile(USER_ID)?.aiName).toBe('Local');
  });
});

describe('pantalla principal', () => {
  const account = {
    id: 'a1',
    name: 'Efectivo',
    currency: 'COP',
    initialBalance: '0',
    isDefault: true,
  };

  it('2.6 sin moneda principal no aparece "registrar movimiento"', async () => {
    // La entrada para registrar ahora es el «+» de la barra; su regla se prueba en us4-tabbar.test.tsx.
    setup({ me: meWith({ onboardingStep: 'done' }) });
    await render(<Home />);
    expect(screen.queryByRole('button', { name: 'Registrar movimiento' })).toBeNull();
  });

  it('con moneda principal muestra "Efectivo" con saldo 0', async () => {
    setup({
      me: meWith({ onboardingStep: 'done', primaryCurrency: 'COP' }, { defaultAccount: account }),
    });
    await render(<Home />);
    expect(screen.getByText('Efectivo')).toBeTruthy();
    expect(screen.getByText(/0 COP/)).toBeTruthy();
  });

  it('FR-017 sin nombre para la IA, el saludo usa la parte del correo antes de la "@"', async () => {
    setup({
      me: meWith({ onboardingStep: 'done', aiName: null }, { email: 'ana.perez@mail.com' }),
    });
    await render(<Home />);
    expect(screen.getByText('Hola, ana.perez')).toBeTruthy();
  });

  it('con nombre para la IA, el saludo lo usa', async () => {
    setup({ me: meWith({ onboardingStep: 'done', aiName: 'Anita' }) });
    await render(<Home />);
    expect(screen.getByText('Hola, Anita')).toBeTruthy();
  });
});
